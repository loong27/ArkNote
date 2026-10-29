import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import type { VaultFileAccess } from '@shared/vaultRead'
import { looksLikeVault } from '@shared/vaultRead'

export const VAULT_DIR = 'vault'
export const VAULT_STAGING_DIR = 'vault-staging'
const DIR = Directory.Data

function normalizeRel(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\/+/, '')
}

function joinPath(...parts: string[]): string {
  return parts
    .map((p) => p.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/')
}

async function ensureDir(path: string): Promise<void> {
  try {
    await Filesystem.mkdir({ path, directory: DIR, recursive: true })
  } catch {
    // already exists
  }
}

export async function vaultExists(): Promise<boolean> {
  try {
    await Filesystem.stat({ path: joinPath(VAULT_DIR, 'salt.bin'), directory: DIR })
    await Filesystem.stat({ path: joinPath(VAULT_DIR, 'verify.enc'), directory: DIR })
    await Filesystem.stat({ path: joinPath(VAULT_DIR, 'metadata.json.enc'), directory: DIR })
    return true
  } catch {
    return false
  }
}

async function readBinaryFile(absRel: string): Promise<Uint8Array> {
  const result = await Filesystem.readFile({ path: absRel, directory: DIR })
  const data = result.data
  if (typeof data === 'string') {
    const binary = atob(data)
    const out = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
    return out
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data)
  }
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  }
  // Capacitor web may return Blob
  const buf = await (data as Blob).arrayBuffer()
  return new Uint8Array(buf)
}

async function writeBinaryFile(absRel: string, bytes: Uint8Array): Promise<void> {
  const parent = absRel.includes('/') ? absRel.slice(0, absRel.lastIndexOf('/')) : ''
  if (parent) await ensureDir(parent)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  await Filesystem.writeFile({
    path: absRel,
    directory: DIR,
    data: btoa(binary),
  })
}

function entryNames(files: Array<string | { name: string }> | undefined): string[] {
  if (!files) return []
  return files.map((f) => (typeof f === 'string' ? f : f.name))
}

async function listRecursive(relDir: string): Promise<string[]> {
  const out: string[] = []
  let names: string[] = []
  try {
    const entries = await Filesystem.readdir({ path: relDir, directory: DIR })
    names = entryNames(entries.files as Array<string | { name: string }> | undefined)
  } catch {
    return out
  }
  for (const name of names) {
    const child = joinPath(relDir, name)
    try {
      const st = await Filesystem.stat({ path: child, directory: DIR })
      if (st.type === 'directory') {
        out.push(...(await listRecursive(child)))
      } else {
        out.push(child)
      }
    } catch {
      // skip
    }
  }
  return out
}

export function createCapacitorVaultAccess(rootDir = VAULT_DIR): VaultFileAccess {
  return {
    async readBinary(relativePath: string) {
      const key = normalizeRel(relativePath)
      return readBinaryFile(joinPath(rootDir, key))
    },
    async listNames(relativePath: string) {
      const dir = joinPath(rootDir, normalizeRel(relativePath))
      try {
        const { files } = await Filesystem.readdir({ path: dir || rootDir, directory: DIR })
        return entryNames(files as Array<string | { name: string }> | undefined)
      } catch {
        return []
      }
    },
  }
}

export async function writeVaultFiles(files: Map<string, Uint8Array>, rootDir = VAULT_DIR): Promise<void> {
  await removeDir(rootDir)
  await ensureDir(rootDir)
  for (const [rel, bytes] of files) {
    const key = normalizeRel(rel)
    if (!key || key.endsWith('/')) continue
    await writeBinaryFile(joinPath(rootDir, key), bytes)
  }
}

export async function removeDir(relDir: string): Promise<void> {
  try {
    await Filesystem.rmdir({ path: relDir, directory: DIR, recursive: true })
  } catch {
    // missing
  }
}

export async function clearStaging(): Promise<void> {
  await removeDir(VAULT_STAGING_DIR)
  await ensureDir(VAULT_STAGING_DIR)
}

/** Native absolute path for plugins that need a real filesystem path (Android/iOS). */
export async function getNativeDirectoryUri(relDir: string): Promise<string> {
  await ensureDir(relDir)
  const { uri } = await Filesystem.getUri({ path: relDir, directory: DIR })
  if (uri.startsWith('file://')) {
    let path = decodeURIComponent(uri.replace(/^file:\/\//, ''))
    // Android getUri may yield /data/... without leading slash quirks on some devices
    if (/^\/[a-z]+\//i.test(path) === false && path.startsWith('/')) {
      // keep as-is
    }
    // On Android, paths often look like /data/user/0/...
    if (path.match(/^[A-Za-z]:\//)) {
      // Windows-style from web — leave
    }
    return path
  }
  return uri
}

export async function validateVaultDir(rootDir: string): Promise<void> {
  const files = new Map<string, Uint8Array>()
  for (const name of ['salt.bin', 'verify.enc', 'metadata.json.enc']) {
    try {
      const data = await readBinaryFile(joinPath(rootDir, name))
      files.set(name, data)
    } catch {
      throw new Error(`远程仓库缺少有效的 ${name}`)
    }
  }
  if (files.get('salt.bin')!.byteLength !== 32) {
    throw new Error('远程仓库缺少有效的 salt.bin')
  }
  if (files.get('verify.enc')!.byteLength < 29) {
    throw new Error('远程仓库缺少有效的 verify.enc')
  }
  if (files.get('metadata.json.enc')!.byteLength < 29) {
    throw new Error('远程仓库缺少有效的 metadata.json.enc')
  }
  if (!looksLikeVault(files)) {
    throw new Error('远程仓库不是有效的 arkNote 加密仓库')
  }
}

/**
 * Replace working vault with staging contents (skip .git).
 */
export async function promoteStagingToVault(): Promise<void> {
  await validateVaultDir(VAULT_STAGING_DIR)
  await removeDir(VAULT_DIR)
  await ensureDir(VAULT_DIR)

  const all = await listRecursive(VAULT_STAGING_DIR)
  for (const abs of all) {
    const rel = abs.slice(VAULT_STAGING_DIR.length).replace(/^\/+/, '')
    if (!rel || rel === '.git' || rel.startsWith('.git/')) continue
    const bytes = await readBinaryFile(abs)
    await writeBinaryFile(joinPath(VAULT_DIR, rel), bytes)
  }
}

/** Capacitor-backed Promise FS for isomorphic-git, rooted at `relRoot` under Directory.Data. */
export function createGitFs(relRoot: string) {
  const root = relRoot.replace(/\/+$/, '')

  const toRel = (filepath: string): string => {
    let norm = String(filepath || '').replace(/\\/g, '/')
    while (norm.startsWith('./')) norm = norm.slice(2)
    if (norm === '.' || norm === '') return root
    if (norm.startsWith('/')) norm = norm.slice(1)
    if (norm === root || norm.startsWith(`${root}/`)) return norm
    return joinPath(root, norm)
  }

  const api = {
    async readFile(filepath: string, opts?: { encoding?: string }) {
      const path = toRel(filepath)
      if (opts?.encoding === 'utf8') {
        const { data } = await Filesystem.readFile({
          path,
          directory: DIR,
          encoding: Encoding.UTF8,
        })
        return String(data)
      }
      return readBinaryFile(path)
    },
    async writeFile(filepath: string, data: Uint8Array | string, opts?: { encoding?: string }) {
      const path = toRel(filepath)
      if (typeof data === 'string' || opts?.encoding === 'utf8') {
        const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
        if (parent) await ensureDir(parent)
        await Filesystem.writeFile({
          path,
          directory: DIR,
          data: String(data),
          encoding: Encoding.UTF8,
        })
        return
      }
      const bytes = data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer)
      await writeBinaryFile(path, bytes)
    },
    async unlink(filepath: string) {
      await Filesystem.deleteFile({ path: toRel(filepath), directory: DIR })
    },
    async readdir(filepath: string) {
      const path = toRel(filepath)
      const { files } = await Filesystem.readdir({ path, directory: DIR })
      return entryNames(files as Array<string | { name: string }> | undefined)
    },
    async mkdir(filepath: string) {
      await ensureDir(toRel(filepath))
    },
    async rmdir(filepath: string) {
      await Filesystem.rmdir({ path: toRel(filepath), directory: DIR, recursive: false })
    },
    async stat(filepath: string) {
      const path = toRel(filepath)
      const st = await Filesystem.stat({ path, directory: DIR })
      const isFile = st.type === 'file'
      return {
        type: isFile ? 'file' : 'dir',
        mode: isFile ? 0o100644 : 0o040755,
        size: st.size ?? 0,
        ino: 0,
        mtimeMs: st.mtime ? Number(st.mtime) : Date.now(),
        ctimeMs: st.mtime ? Number(st.mtime) : Date.now(),
        uid: 1,
        gid: 1,
        dev: 1,
        isFile: () => isFile,
        isDirectory: () => !isFile,
        isSymbolicLink: () => false,
      }
    },
    async lstat(filepath: string) {
      return api.stat(filepath)
    },
    async readlink() {
      throw new Error('symlink not supported')
    },
    async symlink() {
      throw new Error('symlink not supported')
    },
    async chmod() {
      // no-op
    },
  }

  return { promises: api }
}
