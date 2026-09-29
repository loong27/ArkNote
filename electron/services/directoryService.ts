import { FileManager } from './fileManager'
import type { Directory } from '../../src/types'

export class DirectoryService {
  private fileManager: FileManager

  constructor(fileManager: FileManager) {
    this.fileManager = fileManager
  }

  list(): Directory[] {
    const meta = this.fileManager.getMetadata()
    return meta.directories
  }

  create(parentId: string | null, name: string): Directory {
    // Validate directory level (max 3 levels)
    const level = this.getLevel(parentId)
    if (level >= 3) {
      throw new Error('目录层级最多为3级')
    }

    const id = this.fileManager.generateId()
    const now = new Date().toISOString()
    const meta = this.fileManager.getMetadata()

    const dir: Directory = {
      id,
      name,
      parentId,
      order: meta.directories.filter(d => d.parentId === parentId).length,
      createdAt: now,
      updatedAt: now,
    }

    this.fileManager.addDirectory(dir)
    return dir
  }

  rename(id: string, name: string): void {
    this.fileManager.updateDirectory(id, {
      name,
      updatedAt: new Date().toISOString(),
    })
  }

  /**
   * Move a directory (and all its contents) to a new parent directory.
   * Validates: target exists, max 3-level nesting, and target is not the directory itself or one of its descendants.
   */
  move(id: string, targetParentId: string | null): boolean {
    const meta = this.fileManager.getMetadata()
    const dir = meta.directories.find(d => d.id === id)
    if (!dir) return false
    if (dir.parentId === targetParentId) return true

    if (targetParentId !== null) {
      const target = meta.directories.find(d => d.id === targetParentId)
      if (!target) throw new Error('目标目录不存在')

      // Prevent moving into itself or its own descendants
      const descendants = this.getDescendantIds(id)
      if (targetParentId === id || descendants.includes(targetParentId)) {
        throw new Error('不能将目录移动到自身或其子目录中')
      }

      // Validate max nesting level (3 levels)
      const targetLevel = this.getLevel(targetParentId)
      if (targetLevel >= 3) {
        throw new Error('目录层级最多为3级')
      }
    }

    const now = new Date().toISOString()
    this.fileManager.updateDirectory(id, {
      parentId: targetParentId,
      updatedAt: now,
    })

    // Move all notes in this directory and its descendants with it
    const allIds = [id, ...this.getDescendantIds(id)]
    for (const note of meta.notes) {
      if (note.directoryId && allIds.includes(note.directoryId)) {
        this.fileManager.updateNote(note.id, { updatedAt: now })
      }
    }

    return true
  }

  delete(id: string): boolean {
    const meta = this.fileManager.getMetadata()

    // Check for sub-directories
    const subDirs = meta.directories.filter(d => d.parentId === id)
    if (subDirs.length > 0) {
      // Recursively delete sub-directories
      for (const subDir of subDirs) {
        this.delete(subDir.id)
      }
    }

    // Delete all notes in this directory
    const notes = meta.notes.filter(n => n.directoryId === id)
    for (const note of notes) {
      this.fileManager.deleteNoteFile(note.id)
      this.fileManager.removeNote(note.id)
    }

    // Delete directory
    this.fileManager.removeDirectory(id)
    return true
  }

  /**
   * Get the depth level of a directory.
   * Root level is 0, so creating under root makes level 1, etc.
   */
  getLevel(parentId: string | null): number {
    if (parentId === null) return 0

    const meta = this.fileManager.getMetadata()
    let level = 0
    let currentId: string | null = parentId

    while (currentId) {
      level++
      const dir = meta.directories.find(d => d.id === currentId)
      if (!dir) break
      currentId = dir.parentId
    }

    return level
  }

  /**
   * Get the level of a specific directory by its ID
   */
  getLevelById(id: string): number {
    const meta = this.fileManager.getMetadata()
    const dir = meta.directories.find(d => d.id === id)
    if (!dir) return 0
    return this.getLevel(dir.parentId) + 1
  }

  /**
   * Get all descendant directory IDs recursively
   */
  getDescendantIds(id: string): string[] {
    const meta = this.fileManager.getMetadata()
    const result: string[] = []

    const collect = (parentId: string) => {
      const children = meta.directories.filter(d => d.parentId === parentId)
      for (const child of children) {
        result.push(child.id)
        collect(child.id)
      }
    }

    collect(id)
    return result
  }

  /**
   * Get the full path of a directory as an array of names
   */
  getPath(id: string): string[] {
    const meta = this.fileManager.getMetadata()
    const parts: string[] = []
    let currentId: string | null = id

    while (currentId) {
      const dir = meta.directories.find(d => d.id === currentId)
      if (!dir) break
      parts.unshift(dir.name)
      currentId = dir.parentId
    }

    return parts
  }
}

