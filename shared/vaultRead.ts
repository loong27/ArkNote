/**
 * Read-only arkNote vault access. Never writes.
 * Supply bytes through VaultFileAccess (Node fs, Capacitor FS, or in-memory import).
 */

import {
  VAULT_CRYPTO,
  decryptVaultBlob,
  decryptVaultUtf8,
  deriveKeyBytes,
  isSupportedVerifyText,
  toUint8Array,
} from './vaultCrypto'

export interface VaultNoteMeta {
  id: string
  title: string
  directoryId: string
  tags: string[]
  createdAt: string
  updatedAt: string
  order: number
}

export interface VaultDirectoryMeta {
  id: string
  name: string
  parentId: string | null
  order: number
  createdAt: string
  updatedAt: string
}

export interface VaultMetadata {
  directories: VaultDirectoryMeta[]
  notes: VaultNoteMeta[]
  tags: Array<{ id: string; name: string; color: string; createdAt: string }>
  syncConfig?: unknown
}

export interface VaultFileAccess {
  /** Read a vault-relative path, e.g. "salt.bin" or "notes/<id>.md.enc" */
  readBinary(relativePath: string): Promise<Uint8Array>
  /** Optional: list files under a relative directory (no trailing slash) */
  listNames?(relativePath: string): Promise<string[]>
}

export interface VaultSearchHit {
  noteId: string
  title: string
  snippet: string
}

export class VaultReader {
  private key: Uint8Array | null = null
  private metadata: VaultMetadata | null = null
  private noteCache = new Map<string, string>()

  constructor(private readonly files: VaultFileAccess) {}

  isUnlocked(): boolean {
    return this.key !== null
  }

  lock(): void {
    if (this.key) {
      this.key.fill(0)
      this.key = null
    }
    this.metadata = null
    this.noteCache.clear()
  }

  async unlock(password: string): Promise<void> {
    this.lock()
    const salt = toUint8Array(await this.files.readBinary('salt.bin'))
    if (salt.byteLength !== VAULT_CRYPTO.saltLength) {
      throw new Error('invalid salt.bin')
    }
    const key = await deriveKeyBytes(password, salt)
    try {
      const verifyEnc = toUint8Array(await this.files.readBinary('verify.enc'))
      const verifyText = await decryptVaultUtf8(verifyEnc, key)
      if (!isSupportedVerifyText(verifyText)) {
        throw new Error('invalid password')
      }
    } catch {
      key.fill(0)
      throw new Error('invalid password')
    }
    this.key = key
    await this.loadMetadata()
  }

  private requireKey(): Uint8Array {
    if (!this.key) throw new Error('vault is locked')
    return this.key
  }

  async loadMetadata(): Promise<VaultMetadata> {
    const key = this.requireKey()
    const enc = toUint8Array(await this.files.readBinary('metadata.json.enc'))
    const json = await decryptVaultUtf8(enc, key)
    const parsed = JSON.parse(json) as VaultMetadata
    this.metadata = {
      directories: Array.isArray(parsed.directories) ? parsed.directories : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      syncConfig: parsed.syncConfig,
    }
    return this.metadata
  }

  getMetadata(): VaultMetadata {
    if (!this.metadata) throw new Error('metadata not loaded')
    return this.metadata
  }

  listNotes(): VaultNoteMeta[] {
    return [...this.getMetadata().notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  listDirectories(): VaultDirectoryMeta[] {
    return [...this.getMetadata().directories]
  }

  async getNoteContent(noteId: string): Promise<string> {
    const cached = this.noteCache.get(noteId)
    if (cached !== undefined) return cached
    const key = this.requireKey()
    const enc = toUint8Array(await this.files.readBinary(`notes/${noteId}.md.enc`))
    const content = await decryptVaultUtf8(enc, key)
    this.noteCache.set(noteId, content)
    return content
  }

  async search(query: string, limit = 50): Promise<VaultSearchHit[]> {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const hits: VaultSearchHit[] = []
    for (const note of this.listNotes()) {
      const titleHit = note.title.toLowerCase().includes(q)
      let snippet = ''
      let bodyHit = false
      try {
        const content = await this.getNoteContent(note.id)
        const lower = content.toLowerCase()
        const idx = lower.indexOf(q)
        if (idx >= 0) {
          bodyHit = true
          const start = Math.max(0, idx - 40)
          snippet = content.slice(start, start + 120).replace(/\s+/g, ' ')
        }
      } catch {
        // skip unreadable note
      }
      if (titleHit || bodyHit) {
        hits.push({
          noteId: note.id,
          title: note.title,
          snippet: snippet || (titleHit ? `[title] ${note.title}` : ''),
        })
        if (hits.length >= limit) break
      }
    }
    return hits
  }

  /** Decrypt an arbitrary vault-relative .enc file (e.g. images) as raw bytes. */
  async readEncryptedBinary(relativePath: string): Promise<Uint8Array> {
    const key = this.requireKey()
    const enc = toUint8Array(await this.files.readBinary(relativePath))
    return decryptVaultBlob(enc, key)
  }
}

/** In-memory vault built from a path→bytes map ( Capactor import / zip unpack ). */
export function createMemoryFileAccess(files: Map<string, Uint8Array> | Record<string, Uint8Array>): VaultFileAccess {
  const map = files instanceof Map ? files : new Map(Object.entries(files))
  const normalize = (p: string) => p.replace(/\\/g, '/').replace(/^\/+/, '')
  return {
    async readBinary(relativePath: string) {
      const key = normalize(relativePath)
      const data = map.get(key)
      if (!data) throw new Error(`missing file: ${key}`)
      return data
    },
    async listNames(relativePath: string) {
      const prefix = normalize(relativePath).replace(/\/?$/, '/')
      const names = new Set<string>()
      for (const key of map.keys()) {
        if (!key.startsWith(prefix)) continue
        const rest = key.slice(prefix.length)
        if (!rest || rest.includes('/')) continue
        names.add(rest)
      }
      return [...names]
    },
  }
}

/** Detect whether a file map looks like an arkNote vault. */
export function looksLikeVault(files: Map<string, Uint8Array> | Record<string, Uint8Array>): boolean {
  const map = files instanceof Map ? files : new Map(Object.entries(files))
  return map.has('salt.bin') && map.has('verify.enc') && map.has('metadata.json.enc')
}
