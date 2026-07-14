import fs from 'fs'
import path from 'path'
import { FileManager } from './fileManager'
import type { Directory, NoteMetadata, NoteContent, TrashItem, Version } from '../../src/types'

interface TrashMetadata {
  items: TrashItemInternal[]
}

interface TrashItemInternalBase {
  type: 'directory' | 'note'
  id: string
  name: string
  parentId: string | null
  directoryId?: string
  deletedAt: string
  originalPath: string
  groupId?: string
}

interface NoteTrashItemInternal extends TrashItemInternalBase {
  type: 'note'
  metadata: NoteMetadata
}

interface DirectoryTrashItemInternal extends TrashItemInternalBase {
  type: 'directory'
  metadata: Directory
}

type TrashItemInternal = NoteTrashItemInternal | DirectoryTrashItemInternal

export class TrashService {
  private fileManager: FileManager
  private trashMetadata: TrashMetadata | null = null

  constructor(fileManager: FileManager) {
    this.fileManager = fileManager
  }

  private get trashDir(): string {
    return path.join((this.fileManager as any).dataDir, 'trash')
  }

  private get trashNotesDir(): string {
    return path.join(this.trashDir, 'notes')
  }

  private get trashVersionsDir(): string {
    return path.join(this.trashDir, 'versions')
  }

  private get trashMetadataPath(): string {
    return path.join(this.trashDir, 'trash-meta.json.enc')
  }

  ensureTrashDirs(): void {
    const dirs = [this.trashDir, this.trashNotesDir, this.trashVersionsDir]
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }
  }

  private loadTrashMetadata(): TrashMetadata {
    if (this.trashMetadata) return this.trashMetadata

    this.ensureTrashDirs()

    if (fs.existsSync(this.trashMetadataPath)) {
      try {
        const content = (this.fileManager as any).encryption.decryptFileToString(this.trashMetadataPath)
        this.trashMetadata = JSON.parse(content)
      } catch {
        this.trashMetadata = { items: [] }
      }
    } else {
      this.trashMetadata = { items: [] }
    }

    return this.trashMetadata!
  }

  private saveTrashMetadata(): void {
    if (!this.trashMetadata) return
    this.ensureTrashDirs()
    ;(this.fileManager as any).encryption.encryptStringToFile(
      this.trashMetadataPath,
      JSON.stringify(this.trashMetadata, null, 2)
    )
  }

  /**
   * Get directory path as string for display
   */
  private getDirPath(dirId: string | null): string {
    if (!dirId) return '/'
    const meta = this.fileManager.getMetadata()
    const parts: string[] = []
    let currentId: string | null = dirId
    while (currentId) {
      const dir = meta.directories.find(d => d.id === currentId)
      if (!dir) break
      parts.unshift(dir.name)
      currentId = dir.parentId
    }
    return '/' + parts.join('/')
  }

  private restoreNoteFileAndVersions(noteId: string): void {
    const srcPath = path.join(this.trashNotesDir, `${noteId}.md.enc`)
    const destPath = this.fileManager.getNotePath(noteId)
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath)
      fs.unlinkSync(srcPath)
    }

    const srcVersionDir = path.join(this.trashVersionsDir, noteId)
    const destVersionDir = this.fileManager.getVersionDir(noteId)
    if (fs.existsSync(srcVersionDir)) {
      if (!fs.existsSync(destVersionDir)) {
        fs.mkdirSync(destVersionDir, { recursive: true })
      }
      const versionFiles = fs.readdirSync(srcVersionDir)
      for (const file of versionFiles) {
        fs.copyFileSync(
          path.join(srcVersionDir, file),
          path.join(destVersionDir, file)
        )
      }
      fs.rmSync(srcVersionDir, { recursive: true })
    }
  }

  private getFallbackDirectoryId(meta: ReturnType<FileManager['getMetadata']>): string | null {
    const rootDir = meta.directories.find(d => d.parentId === null)
    return rootDir?.id ?? null
  }

  private listVersionFiles(versionDir: string): Array<{ timestamp: string; isManual: boolean; fileName: string }> {
    if (!fs.existsSync(versionDir)) return []

    const files = fs.readdirSync(versionDir)
      .filter(f => f.endsWith('.md.enc'))
      .sort()
      .reverse()

    return files.map(f => ({
      timestamp: f.replace(/^(manual|auto)_/, '').replace('.md.enc', ''),
      isManual: f.startsWith('manual_'),
      fileName: f,
    }))
  }

  listVersions(noteId: string): Version[] {
    const trashMeta = this.loadTrashMetadata()
    const item = trashMeta.items.find((i): i is NoteTrashItemInternal => i.id === noteId && i.type === 'note')
    if (!item) return []

    const versionDir = path.join(this.trashVersionsDir, noteId)
    return this.listVersionFiles(versionDir).map(v => ({
      noteId,
      timestamp: v.timestamp,
      title: item.metadata.title,
      isManual: v.isManual,
    }))
  }

  getVersion(noteId: string, timestamp: string): string {
    const versionDir = path.join(this.trashVersionsDir, noteId)
    const version = this.listVersionFiles(versionDir).find(v => v.timestamp === timestamp)
    if (!version) throw new Error(`Trash version not found: ${timestamp}`)

    return (this.fileManager as any).encryption.decryptFileToString(path.join(versionDir, version.fileName))
  }

  /**
   * Move a note to trash (soft delete)
   */
  trashNote(noteId: string): void {
    const meta = this.fileManager.getMetadata()
    const noteMeta = meta.notes.find(n => n.id === noteId)
    if (!noteMeta) return

    this.ensureTrashDirs()
    const trashMeta = this.loadTrashMetadata()
    trashMeta.items = trashMeta.items.filter(i => !(i.id === noteId && i.type === 'note'))

    // Move note file to trash
    const srcPath = this.fileManager.getNotePath(noteId)
    const destPath = path.join(this.trashNotesDir, `${noteId}.md.enc`)
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath)
      fs.unlinkSync(srcPath)
    }

    // Move versions to trash
    const srcVersionDir = this.fileManager.getVersionDir(noteId)
    const destVersionDir = path.join(this.trashVersionsDir, noteId)
    if (fs.existsSync(srcVersionDir)) {
      if (!fs.existsSync(destVersionDir)) {
        fs.mkdirSync(destVersionDir, { recursive: true })
      }
      const versionFiles = fs.readdirSync(srcVersionDir)
      for (const file of versionFiles) {
        fs.copyFileSync(
          path.join(srcVersionDir, file),
          path.join(destVersionDir, file)
        )
      }
      fs.rmSync(srcVersionDir, { recursive: true })
    }

    // Add to trash metadata
    trashMeta.items.push({
      type: 'note',
      id: noteId,
      name: noteMeta.title,
      parentId: null,
      directoryId: noteMeta.directoryId,
      deletedAt: new Date().toISOString(),
      originalPath: this.getDirPath(noteMeta.directoryId),
      metadata: { ...noteMeta },
    })
    this.saveTrashMetadata()

    // Remove from main metadata
    this.fileManager.removeNote(noteId)
  }

  /**
   * Move a directory and all its contents to trash (soft delete)
   */
  trashDirectory(dirId: string): void {
    const meta = this.fileManager.getMetadata()
    const rootDir = meta.directories.find(d => d.id === dirId)
    if (!rootDir) return

    this.ensureTrashDirs()
    const trashMeta = this.loadTrashMetadata()
    const deletedAt = new Date().toISOString()
    const groupId = dirId
    trashMeta.items = trashMeta.items.filter(i => i.id !== dirId && i.groupId !== groupId)
    const subtreeDirs: Directory[] = []
    const subtreeNotes: NoteMetadata[] = []

    const collectDescendants = (parentId: string) => {
      const currentDir = meta.directories.find(d => d.id === parentId)
      if (currentDir) {
        subtreeDirs.push(currentDir)
      }

      const childNotes = meta.notes.filter(n => n.directoryId === parentId)
      subtreeNotes.push(...childNotes)

      const childDirs = meta.directories.filter(d => d.parentId === parentId)
      for (const childDir of childDirs) {
        collectDescendants(childDir.id)
      }
    }
    collectDescendants(dirId)

    for (const noteMeta of subtreeNotes) {
      const srcPath = this.fileManager.getNotePath(noteMeta.id)
      const destPath = path.join(this.trashNotesDir, `${noteMeta.id}.md.enc`)
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath)
        fs.unlinkSync(srcPath)
      }

      const srcVersionDir = this.fileManager.getVersionDir(noteMeta.id)
      const destVersionDir = path.join(this.trashVersionsDir, noteMeta.id)
      if (fs.existsSync(srcVersionDir)) {
        if (!fs.existsSync(destVersionDir)) {
          fs.mkdirSync(destVersionDir, { recursive: true })
        }
        const versionFiles = fs.readdirSync(srcVersionDir)
        for (const file of versionFiles) {
          fs.copyFileSync(
            path.join(srcVersionDir, file),
            path.join(destVersionDir, file)
          )
        }
        fs.rmSync(srcVersionDir, { recursive: true })
      }
    }

    for (const directoryMeta of subtreeDirs) {
      trashMeta.items.push({
        type: 'directory',
        id: directoryMeta.id,
        name: directoryMeta.name,
        parentId: directoryMeta.parentId,
        deletedAt,
        originalPath: this.getDirPath(directoryMeta.parentId),
        groupId,
        metadata: { ...directoryMeta },
      })
    }

    for (const noteMeta of subtreeNotes) {
      trashMeta.items.push({
        type: 'note',
        id: noteMeta.id,
        name: noteMeta.title,
        parentId: noteMeta.directoryId,
        directoryId: noteMeta.directoryId,
        deletedAt,
        originalPath: this.getDirPath(noteMeta.directoryId),
        groupId,
        metadata: { ...noteMeta },
      })
    }

    this.saveTrashMetadata()

    for (const noteMeta of subtreeNotes) {
      this.fileManager.removeNote(noteMeta.id)
    }
    for (const directoryMeta of [...subtreeDirs].sort((a, b) => b.order - a.order)) {
      this.fileManager.removeDirectory(directoryMeta.id)
    }
  }

  /**
   * List all items in trash
   */
  list(): TrashItem[] {
    const trashMeta = this.loadTrashMetadata()
    return trashMeta.items
      .filter(item => item.type === 'note' || !item.groupId || item.groupId === item.id)
      .map(item => ({
        type: item.type,
        id: item.id,
        name: item.name,
        parentId: item.parentId,
        directoryId: item.directoryId,
        deletedAt: item.deletedAt,
        originalPath: item.originalPath,
      }))
  }

  /**
   * Restore a note from trash
   */
  restoreNote(noteId: string): void {
    const trashMeta = this.loadTrashMetadata()
    const item = trashMeta.items.find(i => i.id === noteId && i.type === 'note')
    if (!item) return

    const meta = this.fileManager.getMetadata()
    // Support old trash entries that lack the metadata field
    const noteMeta: NoteMetadata = item.metadata ?? {
      id: item.id,
      title: item.name,
      directoryId: item.directoryId ?? this.getFallbackDirectoryId(meta) ?? '',
      tags: [],
      createdAt: item.deletedAt,
      updatedAt: item.deletedAt,
      order: 0,
    }
    let directoryId = noteMeta.directoryId
    if (!meta.directories.find(d => d.id === directoryId)) {
      const fallbackDirectoryId = this.getFallbackDirectoryId(meta)
      if (!fallbackDirectoryId) {
        return
      }
      directoryId = fallbackDirectoryId
    }

    this.restoreNoteFileAndVersions(noteId)

    this.fileManager.addNote({
      ...noteMeta,
      directoryId,
    })

    trashMeta.items = trashMeta.items.filter(i => !(i.id === noteId && i.type === 'note'))
    this.saveTrashMetadata()
  }

  /**
   * Restore a directory from trash
   */
  restoreDirectory(dirId: string): void {
    const trashMeta = this.loadTrashMetadata()
    const rootItem = trashMeta.items.find(i => i.id === dirId && i.type === 'directory')
    if (!rootItem) return

    const groupId = rootItem.groupId || dirId
    const directoryItems = trashMeta.items
      .filter((i): i is DirectoryTrashItemInternal => i.type === 'directory' && i.groupId === groupId)
      .sort((a, b) => {
        const aIsRoot = a.id === dirId ? 0 : 1
        const bIsRoot = b.id === dirId ? 0 : 1
        if (aIsRoot !== bIsRoot) return aIsRoot - bIsRoot
        return a.originalPath.localeCompare(b.originalPath)
      })

    const existingMeta = this.fileManager.getMetadata()
    const restoredDirIds = new Set<string>()

    for (const item of directoryItems) {
      let parentId = item.metadata.parentId
      if (item.id === dirId) {
        if (parentId && !existingMeta.directories.find(d => d.id === parentId)) {
          parentId = null
        }
      } else if (parentId && !restoredDirIds.has(parentId) && !this.fileManager.getMetadata().directories.find(d => d.id === parentId)) {
        parentId = dirId
      }

      this.fileManager.addDirectory({
        ...item.metadata,
        parentId,
      })
      restoredDirIds.add(item.id)
    }

    const noteItems = trashMeta.items
      .filter((i): i is NoteTrashItemInternal => i.type === 'note' && i.groupId === groupId)
      .sort((a, b) => a.metadata.order - b.metadata.order)

    for (const noteItem of noteItems) {
      const currentMeta = this.fileManager.getMetadata()
      let directoryId = noteItem.metadata.directoryId
      if (!currentMeta.directories.find(d => d.id === directoryId)) {
        directoryId = dirId
      }

      this.restoreNoteFileAndVersions(noteItem.id)
      this.fileManager.addNote({
        ...noteItem.metadata,
        directoryId,
      })
    }

    trashMeta.items = trashMeta.items.filter(i => i.groupId !== groupId)
    this.saveTrashMetadata()
  }

  /**
   * Permanently delete a note (and all versions)
   */
  deletePermanentlyNote(noteId: string): void {
    const trashMeta = this.loadTrashMetadata()

    // Delete note file
    const notePath = path.join(this.trashNotesDir, `${noteId}.md.enc`)
    if (fs.existsSync(notePath)) {
      fs.unlinkSync(notePath)
    }

    // Delete versions
    const versionDir = path.join(this.trashVersionsDir, noteId)
    if (fs.existsSync(versionDir)) {
      fs.rmSync(versionDir, { recursive: true })
    }

    // Remove from trash metadata
    trashMeta.items = trashMeta.items.filter(i => !(i.id === noteId && i.type === 'note'))
    this.saveTrashMetadata()
  }

  /**
   * Permanently delete a directory and all its contents
   */
  deletePermanentlyDirectory(dirId: string): void {
    const trashMeta = this.loadTrashMetadata()
    const item = trashMeta.items.find(i => i.id === dirId && i.type === 'directory')
    if (!item) return

    const groupId = item.groupId || dirId
    const noteIds = trashMeta.items
      .filter((i): i is NoteTrashItemInternal => i.type === 'note' && i.groupId === groupId)
      .map(i => i.id)

    for (const noteId of noteIds) {
      this.deletePermanentlyNote(noteId)
    }

    trashMeta.items = trashMeta.items.filter(i => i.groupId !== groupId)
    this.saveTrashMetadata()
  }

  /**
   * Empty the entire trash
   */
  emptyTrash(): void {
    const trashMeta = this.loadTrashMetadata()

    // Delete all note files
    if (fs.existsSync(this.trashNotesDir)) {
      const files = fs.readdirSync(this.trashNotesDir)
      for (const file of files) {
        fs.unlinkSync(path.join(this.trashNotesDir, file))
      }
    }

    // Delete all version directories
    if (fs.existsSync(this.trashVersionsDir)) {
      const dirs = fs.readdirSync(this.trashVersionsDir)
      for (const dir of dirs) {
        fs.rmSync(path.join(this.trashVersionsDir, dir), { recursive: true })
      }
    }

    // Clear metadata
    trashMeta.items = []
    this.saveTrashMetadata()
  }

  /**
   * Get note content from trash for preview
   */
  getNoteContent(noteId: string): NoteContent | null {
    const trashMeta = this.loadTrashMetadata()
    const item = trashMeta.items.find(i => i.id === noteId && i.type === 'note')
    if (!item) return null

    const notePath = path.join(this.trashNotesDir, `${noteId}.md.enc`)
    if (!fs.existsSync(notePath)) return null

    try {
      const content = (this.fileManager as any).encryption.decryptFileToString(notePath)
      return {
        id: noteId,
        content,
        metadata: { ...item.metadata },
      }
    } catch {
      return null
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.trashMetadata = null
  }
}
