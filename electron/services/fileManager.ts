import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { EncryptionService } from './encryption'
import type { AppMetadata, Directory, NoteMetadata, Tag } from '../../src/types'

/**
 * FileManager handles all file I/O operations with encryption.
 * Directory structure:
 *   dataDir/
 *     salt.bin              (unencrypted - PBKDF2 salt)
 *     verify.enc            (encrypted verification token)
 *     metadata.json.enc     (encrypted metadata)
 *     notes/
 *       <note-id>.md.enc    (encrypted note content)
 *     images/
 *       <image-id>.enc      (encrypted images)
 *     versions/
 *       <note-id>/
 *         <timestamp>.md.enc (encrypted version snapshots)
 */
const MAX_NOTE_CONTENT_CACHE = 100

export class FileManager {
  private encryption: EncryptionService
  private dataDir: string
  private metadata: AppMetadata | null = null
  private noteContentCache: Map<string, string> = new Map()
  private noteContentCacheOrder: string[] = []
  private imageFileCache: Map<string, string> | null = null

  constructor(dataDir: string, encryption: EncryptionService) {
    this.dataDir = dataDir
    this.encryption = encryption
  }

  // ========== Directory Paths ==========

  get notesDir(): string {
    return path.join(this.dataDir, 'notes')
  }

  get imagesDir(): string {
    return path.join(this.dataDir, 'images')
  }

  get versionsDir(): string {
    return path.join(this.dataDir, 'versions')
  }

  get metadataPath(): string {
    return path.join(this.dataDir, 'metadata.json.enc')
  }

  // ========== Initialization ==========

  ensureDirectories(): void {
    const dirs = [this.notesDir, this.imagesDir, this.versionsDir]
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }
  }

  // ========== Metadata Operations ==========

  loadMetadata(): AppMetadata {
    if (this.metadata) return this.metadata

    if (fs.existsSync(this.metadataPath)) {
      const content = this.encryption.decryptFileToString(this.metadataPath)
      this.metadata = JSON.parse(content) as AppMetadata
    } else {
      this.metadata = this.createDefaultMetadata()
      this.saveMetadata()
    }

    return this.metadata
  }

  saveMetadata(): void {
    if (!this.metadata) return
    this.encryption.encryptStringToFile(
      this.metadataPath,
      JSON.stringify(this.metadata, null, 2)
    )
  }

  getMetadata(): AppMetadata {
    if (!this.metadata) {
      return this.loadMetadata()
    }
    return this.metadata
  }

  private createDefaultMetadata(): AppMetadata {
    return {
      directories: [],
      notes: [],
      tags: [],
      syncConfig: {
        enabled: false,
        provider: 'git',
        repoUrl: '',
        branch: 'main',
        ossEndpoint: '',
        ossBucket: '',
        ossAccessKey: '',
        ossSecretKey: '',
        ossRegion: '',
        autoSync: false,
        syncInterval: 30,
      },
    }
  }

  // ========== Note File Operations ==========

  getNotePath(noteId: string): string {
    return path.join(this.notesDir, `${noteId}.md.enc`)
  }

  readNoteContent(noteId: string): string {
    const cached = this.noteContentCache.get(noteId)
    if (cached !== undefined) {
      // Move to end (most recently used)
      const idx = this.noteContentCacheOrder.indexOf(noteId)
      if (idx >= 0) {
        this.noteContentCacheOrder.splice(idx, 1)
        this.noteContentCacheOrder.push(noteId)
      }
      return cached
    }

    const filePath = this.getNotePath(noteId)
    if (!fs.existsSync(filePath)) {
      this.noteContentCache.delete(noteId)
      const idx = this.noteContentCacheOrder.indexOf(noteId)
      if (idx >= 0) this.noteContentCacheOrder.splice(idx, 1)
      return ''
    }

    // LRU eviction before adding new entry
    if (this.noteContentCacheOrder.length >= MAX_NOTE_CONTENT_CACHE) {
      const oldest = this.noteContentCacheOrder.shift()!
      this.noteContentCache.delete(oldest)
    }

    const content = this.encryption.decryptFileToString(filePath)
    this.noteContentCache.set(noteId, content)
    this.noteContentCacheOrder.push(noteId)
    return content
  }

  writeNoteContent(noteId: string, content: string): void {
    this.encryption.encryptStringToFile(this.getNotePath(noteId), content)
    // Update cache, moving to end
    if (!this.noteContentCache.has(noteId) && this.noteContentCacheOrder.length >= MAX_NOTE_CONTENT_CACHE) {
      const oldest = this.noteContentCacheOrder.shift()!
      this.noteContentCache.delete(oldest)
    }
    this.noteContentCache.set(noteId, content)
    const idx = this.noteContentCacheOrder.indexOf(noteId)
    if (idx >= 0) this.noteContentCacheOrder.splice(idx, 1)
    this.noteContentCacheOrder.push(noteId)
  }

  deleteNoteFile(noteId: string): void {
    this.noteContentCache.delete(noteId)
    const idx = this.noteContentCacheOrder.indexOf(noteId)
    if (idx >= 0) this.noteContentCacheOrder.splice(idx, 1)
    const filePath = this.getNotePath(noteId)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
    // Also delete versions
    const versionDir = path.join(this.versionsDir, noteId)
    if (fs.existsSync(versionDir)) {
      fs.rmSync(versionDir, { recursive: true })
    }
  }

  // ========== Image Operations ==========

  private getImageFileMap(): Map<string, string> {
    if (this.imageFileCache) return this.imageFileCache

    this.imageFileCache = new Map()
    if (!fs.existsSync(this.imagesDir)) return this.imageFileCache

    const files = fs.readdirSync(this.imagesDir)
    for (const f of files) {
      if (!f.endsWith('.enc')) continue
      // Strip extension to get the base name like "<uuid>.png" → "<uuid>"
      const dotIdx = f.lastIndexOf('.')
      const baseName = dotIdx > 0 ? f.substring(0, dotIdx) : f
      // Extract imageId: the UUID part is always at the start
      const uuidMatch = baseName.match(/^([a-f0-9-]{36})/)
      if (uuidMatch) {
        this.imageFileCache.set(uuidMatch[1], f)
      }
    }
    return this.imageFileCache
  }

  private invalidateImageCache(): void {
    this.imageFileCache = null
  }

  saveImage(imageData: Buffer, extension: string): string {
    const imageId = crypto.randomUUID()
    const imagePath = path.join(this.imagesDir, `${imageId}${extension}.enc`)
    this.encryption.encryptFile(imagePath, imageData)
    this.invalidateImageCache()
    return imageId
  }

  readImage(imageId: string): Buffer | null {
    const imageFile = this.getImageFileMap().get(imageId)
    if (!imageFile) return null

    const imagePath = path.join(this.imagesDir, imageFile)
    return this.encryption.decryptFile(imagePath)
  }

  getImageMimeType(imageId: string): string {
    const imageFile = this.getImageFileMap().get(imageId)
    if (!imageFile) return 'image/png'

    const ext = imageFile.replace(imageId, '').replace(/\.enc$/, '').toLowerCase()
    const mimeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp',
    }
    return mimeMap[ext] || 'image/png'
  }

  deleteImage(imageId: string): void {
    const imageFile = this.getImageFileMap().get(imageId)
    if (imageFile) {
      fs.unlinkSync(path.join(this.imagesDir, imageFile))
      this.invalidateImageCache()
    }
  }

  // ========== Version Operations ==========

  getVersionDir(noteId: string): string {
    return path.join(this.versionsDir, noteId)
  }

  saveVersion(noteId: string, content: string, isManual: boolean): void {
    const versionDir = this.getVersionDir(noteId)
    if (!fs.existsSync(versionDir)) {
      fs.mkdirSync(versionDir, { recursive: true })
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const prefix = isManual ? 'manual' : 'auto'
    const fileName = `${prefix}_${timestamp}.md.enc`
    this.encryption.encryptStringToFile(path.join(versionDir, fileName), content)
  }

  listVersions(noteId: string): Array<{ timestamp: string; isManual: boolean; fileName: string }> {
    const versionDir = this.getVersionDir(noteId)
    if (!fs.existsSync(versionDir)) return []

    const files = fs.readdirSync(versionDir)
      .filter(f => f.endsWith('.md.enc'))
      .sort()
      .reverse()

    return files.map(f => {
      const isManual = f.startsWith('manual_')
      const timestampStr = f
        .replace(/^(manual|auto)_/, '')
        .replace('.md.enc', '')
        .replace(/-/g, (m, offset: number) => {
          // Restore ISO format: first 2 dashes are date, then T, then colons
          if (offset <= 7) return '-'
          if (offset === 10) return 'T'
          return ':'
        })
      return {
        timestamp: f.replace(/^(manual|auto)_/, '').replace('.md.enc', ''),
        isManual,
        fileName: f,
      }
    })
  }

  readVersion(noteId: string, fileName: string): string {
    const filePath = path.join(this.getVersionDir(noteId), fileName)
    return this.encryption.decryptFileToString(filePath)
  }

  // ========== Directory & Note Metadata Operations ==========

  addDirectory(dir: Directory): void {
    const meta = this.getMetadata()
    meta.directories.push(dir)
    this.saveMetadata()
  }

  updateDirectory(id: string, updates: Partial<Directory>): void {
    const meta = this.getMetadata()
    const idx = meta.directories.findIndex(d => d.id === id)
    if (idx !== -1) {
      meta.directories[idx] = { ...meta.directories[idx], ...updates }
      this.saveMetadata()
    }
  }

  removeDirectory(id: string): void {
    const meta = this.getMetadata()
    meta.directories = meta.directories.filter(d => d.id !== id)
    this.saveMetadata()
  }

  addNote(note: NoteMetadata): void {
    const meta = this.getMetadata()
    meta.notes.push(note)
    this.saveMetadata()
  }

  updateNote(id: string, updates: Partial<NoteMetadata>): void {
    const meta = this.getMetadata()
    const idx = meta.notes.findIndex(n => n.id === id)
    if (idx !== -1) {
      meta.notes[idx] = { ...meta.notes[idx], ...updates }
      this.saveMetadata()
    }
  }

  removeNote(id: string): void {
    const meta = this.getMetadata()
    meta.notes = meta.notes.filter(n => n.id !== id)
    this.noteContentCache.delete(id)
    const idx = this.noteContentCacheOrder.indexOf(id)
    if (idx >= 0) this.noteContentCacheOrder.splice(idx, 1)
    this.saveMetadata()
  }

  addTag(tag: Tag): void {
    const meta = this.getMetadata()
    meta.tags.push(tag)
    this.saveMetadata()
  }

  removeTag(id: string): void {
    const meta = this.getMetadata()
    meta.tags = meta.tags.filter(t => t.id !== id)
    // Also remove tag references from notes
    meta.notes.forEach(note => {
      note.tags = note.tags.filter(t => t !== id)
    })
    this.saveMetadata()
  }

  updateSyncConfig(config: Partial<AppMetadata['syncConfig']>): void {
    const meta = this.getMetadata()
    meta.syncConfig = { ...meta.syncConfig, ...config }
    this.saveMetadata()
  }

  // ========== Utility ==========

  generateId(): string {
    return crypto.randomUUID()
  }

  clearCache(): void {
    this.metadata = null
    this.noteContentCache.clear()
    this.noteContentCacheOrder.length = 0
    this.imageFileCache = null
  }
}
