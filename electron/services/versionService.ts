import { FileManager } from './fileManager'
import type { Version } from '../../src/types'

const MANUAL_SAVE_DEDUP_MS = 30_000
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const WEEK = 7 * DAY

function buildUnifiedDiff(a: string, b: string, aLabel: string, bLabel: string): string {
  const aLines = a.split('\n')
  const bLines = b.split('\n')
  const lines: string[] = [`--- ${aLabel}`, `+++ ${bLabel}`]
  const max = Math.max(aLines.length, bLines.length)
  let hunkStart = -1
  const hunk: string[] = []

  const flush = () => {
    if (hunk.length === 0) return
    lines.push(`@@ -${hunkStart + 1} +${hunkStart + 1} @@`)
    lines.push(...hunk)
    hunk.length = 0
  }

  for (let i = 0; i < max; i++) {
    const left = aLines[i]
    const right = bLines[i]
    if (left === right) {
      if (hunk.length) flush()
      continue
    }
    if (hunkStart < 0 || hunk.length === 0) hunkStart = i
    if (left !== undefined) hunk.push(`-${left}`)
    if (right !== undefined) hunk.push(`+${right}`)
  }
  flush()
  if (lines.length === 2) lines.push('@@ 无差异 @@')
  return lines.join('\n')
}

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

    return this.fileManager.listVersions(noteId).map(v => ({
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
    this.prune(noteId)
  }

  diff(noteId: string, timestamp: string): { current: string; version: string; unified: string } {
    const current = this.fileManager.readNoteContent(noteId)
    const version = this.get(noteId, timestamp)
    return {
      current,
      version,
      unified: buildUnifiedDiff(version, current, `version/${timestamp}`, 'current'),
    }
  }

  /**
   * Retention: keep all manual; auto within 24h keep all;
   * older auto keep one per day for 30d, then one per week.
   */
  prune(noteId?: string): { removed: number } {
    const now = Date.now()
    const keptBuckets = new Set<string>()

    const removed = this.fileManager.pruneVersions(noteId, (fileName, isManual, mtimeMs) => {
      if (isManual) return true
      const age = now - mtimeMs
      if (age <= DAY) return true

      const d = new Date(mtimeMs)
      if (age <= 30 * DAY) {
        const key = `d:${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`
        if (keptBuckets.has(key)) return false
        keptBuckets.add(key)
        return true
      }

      const week = Math.floor(mtimeMs / WEEK)
      const key = `w:${week}`
      if (keptBuckets.has(key)) return false
      keptBuckets.add(key)
      return true
    })

    return { removed }
  }
}
