import { FileManager } from './fileManager'
import type { Tag, NoteMetadata } from '../../src/types'

export class TagService {
  private fileManager: FileManager

  constructor(fileManager: FileManager) {
    this.fileManager = fileManager
  }

  list(): Tag[] {
    return this.fileManager.getMetadata().tags
  }

  create(name: string, color: string): Tag {
    const meta = this.fileManager.getMetadata()
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

  rename(id: string, name: string): Tag {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('标签名称不能为空')
    const meta = this.fileManager.getMetadata()
    if (meta.tags.some(t => t.name === trimmed && t.id !== id)) {
      throw new Error(`标签已存在: ${trimmed}`)
    }
    const updated = this.fileManager.updateTag(id, { name: trimmed })
    if (!updated) throw new Error('标签不存在')
    return updated
  }

  delete(id: string, removeFromNotes = false): { success: boolean; message: string } {
    const meta = this.fileManager.getMetadata()
    const associatedNotes = meta.notes.filter(n => n.tags.includes(id))

    if (associatedNotes.length > 0 && !removeFromNotes) {
      return {
        success: false,
        message: `该标签关联了 ${associatedNotes.length} 篇笔记，无法删除。请先移除关联后再删除，或选择同时移除关联。`,
      }
    }

    if (removeFromNotes) {
      for (const note of associatedNotes) {
        this.fileManager.updateNote(note.id, {
          tags: note.tags.filter(t => t !== id),
        })
      }
    }

    this.fileManager.removeTag(id)
    return { success: true, message: '标签已删除' }
  }

  assign(noteId: string, tagIds: string[]): void {
    this.fileManager.updateNote(noteId, { tags: tagIds })
  }

  getNotesForTag(tagId: string): NoteMetadata[] {
    return this.fileManager.getMetadata().notes.filter(n => n.tags.includes(tagId))
  }

  getTagNoteCounts(): Map<string, number> {
    const meta = this.fileManager.getMetadata()
    const counts = new Map<string, number>()
    for (const tag of meta.tags) {
      counts.set(tag.id, meta.notes.filter(n => n.tags.includes(tag.id)).length)
    }
    return counts
  }
}
