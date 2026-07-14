import { FileManager } from './fileManager'
import type { Version } from '../../src/types'

const MANUAL_SAVE_DEDUP_MS = 30_000

export class VersionService {
  private fileManager: FileManager
  private lastManualSaveTime: Map<string, number> = new Map()

  constructor(fileManager: FileManager) {
    this.fileManager = fileManager
  }

  list(noteId: string): Version[] {
    const meta = this.fileManager.getMetadata()
    const note = meta.notes.find(n => n.id === noteId)
    if (!note) return []

    const versions = this.fileManager.listVersions(noteId)
    return versions.map(v => ({
      noteId,
      timestamp: v.timestamp,
      title: note.title,
      isManual: v.isManual,
    }))
  }

  get(noteId: string, timestamp: string): string {
    const versions = this.fileManager.listVersions(noteId)
    const version = versions.find(v => v.timestamp === timestamp)
    if (!version) throw new Error(`Version not found: ${timestamp}`)

    return this.fileManager.readVersion(noteId, version.fileName)
  }

  save(noteId: string): void {
    const now = Date.now()
    const lastSave = this.lastManualSaveTime.get(noteId) || 0
    if (now - lastSave < MANUAL_SAVE_DEDUP_MS) return

    const content = this.fileManager.readNoteContent(noteId)
    this.fileManager.saveVersion(noteId, content, true)
    this.lastManualSaveTime.set(noteId, now)
  }
}
