import { FileManager } from './fileManager'
import type { NoteMetadata, NoteContent } from '../../src/types'

export class NoteService {
  private fileManager: FileManager
  private autoSaveTimers: Map<string, NodeJS.Timeout> = new Map()
  private lastVersionTime: Map<string, number> = new Map()
  private noteModified: Map<string, boolean> = new Map()
  private VERSION_INTERVAL = 30 * 60 * 1000 // 30 minutes

  constructor(fileManager: FileManager) {
    this.fileManager = fileManager
  }

  list(): NoteMetadata[] {
    const meta = this.fileManager.getMetadata()
    return meta.notes
  }

  get(id: string): NoteContent {
    const meta = this.fileManager.getMetadata()
    const noteMeta = meta.notes.find(n => n.id === id)
    if (!noteMeta) throw new Error(`Note not found: ${id}`)

    const content = this.fileManager.readNoteContent(id)
    return { id, content, metadata: noteMeta }
  }

  create(directoryId: string, title: string): NoteMetadata {
    const id = this.fileManager.generateId()
    const now = new Date().toISOString()

    const note: NoteMetadata = {
      id,
      title,
      directoryId,
      tags: [],
      createdAt: now,
      updatedAt: now,
      order: this.list().filter(n => n.directoryId === directoryId).length,
    }

    this.fileManager.addNote(note)
    this.fileManager.writeNoteContent(id, `# ${title}\n\n`)
    return note
  }

  update(id: string, content: string): void {
    const now = new Date().toISOString()
    this.fileManager.writeNoteContent(id, content)
    this.fileManager.updateNote(id, { updatedAt: now })

    // Mark as modified for auto-versioning
    this.noteModified.set(id, true)

    // Setup auto-version check
    this.scheduleAutoVersion(id, content)
  }

  updateTitle(id: string, title: string): void {
    const now = new Date().toISOString()
    this.fileManager.updateNote(id, { title, updatedAt: now })
  }

  delete(id: string): void {
    this.fileManager.deleteNoteFile(id)
    this.fileManager.removeNote(id)
    this.clearTimers(id)
  }

  move(id: string, targetDirectoryId: string): void {
    const now = new Date().toISOString()
    const order = this.list().filter(n => n.directoryId === targetDirectoryId).length
    this.fileManager.updateNote(id, {
      directoryId: targetDirectoryId,
      updatedAt: now,
      order,
    })
  }

  /**
   * Manual version save (Ctrl+S)
   */
  saveVersion(id: string): void {
    const content = this.fileManager.readNoteContent(id)
    this.fileManager.saveVersion(id, content, true)
    this.lastVersionTime.set(id, Date.now())
    this.noteModified.set(id, false)
  }

  /**
   * Schedule auto-version check.
   * If 30 minutes pass without modification, save a version.
   */
  private scheduleAutoVersion(noteId: string, content: string): void {
    // Clear existing timer
    const existingTimer = this.autoSaveTimers.get(noteId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Set a timer - if no more edits for 30 min, save version
    const timer = setTimeout(() => {
      if (this.noteModified.get(noteId)) {
        const lastVersion = this.lastVersionTime.get(noteId) || 0
        const elapsed = Date.now() - lastVersion

        if (elapsed >= this.VERSION_INTERVAL) {
          this.fileManager.saveVersion(noteId, content, false)
          this.lastVersionTime.set(noteId, Date.now())
          this.noteModified.set(noteId, false)
        }
      }
      this.autoSaveTimers.delete(noteId)
    }, this.VERSION_INTERVAL)

    this.autoSaveTimers.set(noteId, timer)
  }

  private clearTimers(noteId: string): void {
    const timer = this.autoSaveTimers.get(noteId)
    if (timer) {
      clearTimeout(timer)
      this.autoSaveTimers.delete(noteId)
    }
    this.lastVersionTime.delete(noteId)
    this.noteModified.delete(noteId)
  }

  /**
   * Cleanup all timers on app close
   */
  cleanup(): void {
    for (const timer of this.autoSaveTimers.values()) {
      clearTimeout(timer)
    }
    this.autoSaveTimers.clear()
    this.lastVersionTime.clear()
    this.noteModified.clear()
  }
}
