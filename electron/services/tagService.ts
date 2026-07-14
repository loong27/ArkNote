import { FileManager } from './fileManager'
import type { Tag, NoteMetadata } from '../../src/types'

export class TagService {
  private fileManager: FileManager

  constructor(fileManager: FileManager) {
    this.fileManager = fileManager
  }

  list(): Tag[] {
    const meta = this.fileManager.getMetadata()
    return meta.tags
  }

  create(name: string, color: string): Tag {
    const meta = this.fileManager.getMetadata()

    // Check for duplicate name
    if (meta.tags.some(t => t.name === name)) {
      throw new Error(`Tag already exists: ${name}`)
    }

    const tag: Tag = {
      id: this.fileManager.generateId(),
      name,
      color,
      createdAt: new Date().toISOString(),
    }

    this.fileManager.addTag(tag)
    return tag
  }

  delete(id: string): { success: boolean; message: string } {
    const meta = this.fileManager.getMetadata()

    // Check if tag is associated with any notes
    const associatedNotes = meta.notes.filter(n => n.tags.includes(id))
    if (associatedNotes.length > 0) {
      return {
        success: false,
        message: `该标签关联了 ${associatedNotes.length} 篇笔记，无法删除。请先移除关联后再删除。`,
      }
    }

    this.fileManager.removeTag(id)
    return { success: true, message: '标签已删除' }
  }

  assign(noteId: string, tagIds: string[]): void {
    this.fileManager.updateNote(noteId, { tags: tagIds })
  }

  getNotesForTag(tagId: string): NoteMetadata[] {
    const meta = this.fileManager.getMetadata()
    return meta.notes.filter(n => n.tags.includes(tagId))
  }

  /**
   * Get note count for each tag
   */
  getTagNoteCounts(): Map<string, number> {
    const meta = this.fileManager.getMetadata()
    const counts = new Map<string, number>()

    for (const tag of meta.tags) {
      const count = meta.notes.filter(n => n.tags.includes(tag.id)).length
      counts.set(tag.id, count)
    }

    return counts
  }
}
