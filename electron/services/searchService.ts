import { FileManager } from './fileManager'
import type { NoteMetadata, SearchResult, SearchMatch } from '../../src/types'

const MAX_GLOBAL_MATCHES_PER_NOTE = 3
const DEFAULT_GLOBAL_TOTAL_LIMIT = 50

type CachedSearchEntry = {
  noteId: string
  title: string
  titleLower: string
  directoryId: string
  tags: string[]
  content: string
  contentLower: string
}

export class SearchService {
  private fileManager: FileManager
  private globalSearchCache: Map<string, CachedSearchEntry> = new Map()

  constructor(fileManager: FileManager) {
    this.fileManager = fileManager
  }

  clearCache(): void {
    this.globalSearchCache.clear()
  }

  removeNote(noteId: string): void {
    this.globalSearchCache.delete(noteId)
  }

  upsertNote(noteId: string): void {
    const meta = this.fileManager.getMetadata()
    const note = meta.notes.find(n => n.id === noteId)
    if (!note) {
      this.removeNote(noteId)
      return
    }

    const content = this.fileManager.readNoteContent(noteId)
    this.globalSearchCache.set(noteId, {
      noteId,
      title: note.title,
      titleLower: note.title.toLowerCase(),
      directoryId: note.directoryId,
      tags: [...note.tags],
      content,
      contentLower: content.toLowerCase(),
    })
  }

  ensureIndex(): void {
    const meta = this.fileManager.getMetadata()
    const liveIds = new Set(meta.notes.map(n => n.id))
    for (const id of this.globalSearchCache.keys()) {
      if (!liveIds.has(id)) this.globalSearchCache.delete(id)
    }
    for (const note of meta.notes) {
      if (!this.globalSearchCache.has(note.id)) {
        try {
          this.upsertNote(note.id)
        } catch {
          this.removeNote(note.id)
        }
      }
    }
  }

  global(
    query: string,
    directoryIds?: string[],
    totalLimit: number = DEFAULT_GLOBAL_TOTAL_LIMIT,
    tagIds?: string[],
    offset = 0,
  ): SearchResult[] {
    if (!query.trim()) return []
    this.ensureIndex()

    const meta = this.fileManager.getMetadata()
    let notes = meta.notes

    if (directoryIds && directoryIds.length > 0) {
      const allDirIds = new Set<string>()
      const addSubDirs = (dirId: string) => {
        allDirIds.add(dirId)
        meta.directories.filter(d => d.parentId === dirId).forEach(d => addSubDirs(d.id))
      }
      directoryIds.forEach(id => addSubDirs(id))
      notes = notes.filter(n => allDirIds.has(n.directoryId))
    }

    if (tagIds && tagIds.length > 0) {
      const tagSet = new Set(tagIds)
      notes = notes.filter(n => n.tags.some(t => tagSet.has(t)))
    }

    const lowerQuery = query.toLowerCase()
    const scored: Array<{ score: number; result: SearchResult }> = []

    for (const note of notes) {
      try {
        const cached = this.getOrCreateCachedEntry(note.id)
        const matches = this.findMatches(cached.content, query, lowerQuery, MAX_GLOBAL_MATCHES_PER_NOTE)
        const titleIdx = cached.titleLower.indexOf(lowerQuery)
        let score = 0

        if (titleIdx !== -1) {
          score += 100 - Math.min(50, titleIdx)
          matches.unshift({
            line: 0,
            column: titleIdx,
            length: query.length,
            text: query,
            context: `[标题] ${cached.title}`,
          })
        }

        if (cached.contentLower.includes(lowerQuery)) {
          score += Math.min(40, matches.length * 8 + 5)
        }

        // Chinese bigram soft boost: if query is CJK and any char appears in title
        if (/[\u4e00-\u9fff]/.test(query) && [...query].some(ch => cached.titleLower.includes(ch))) {
          score += 10
        }

        const limitedMatches = matches.slice(0, MAX_GLOBAL_MATCHES_PER_NOTE)
        if (limitedMatches.length > 0) {
          scored.push({
            score,
            result: {
              noteId: note.id,
              noteTitle: cached.title,
              directoryId: cached.directoryId,
              directoryPath: this.getDirectoryPath(cached.directoryId),
              matches: limitedMatches,
            },
          })
        }
      } catch {
        this.globalSearchCache.delete(note.id)
      }
    }

    scored.sort((a, b) => b.score - a.score || a.result.noteTitle.localeCompare(b.result.noteTitle))
    const safeOffset = Math.max(0, offset)
    const safeLimit = Math.min(500, Math.max(1, totalLimit))
    return scored.slice(safeOffset, safeOffset + safeLimit).map(s => s.result)
  }

  byTitle(query: string, limit = 20): NoteMetadata[] {
    this.ensureIndex()
    const meta = this.fileManager.getMetadata()
    const q = query.trim().toLowerCase()
    const scored = meta.notes.map(note => {
      const titleLower = note.title.toLowerCase()
      let score = 0
      if (!q) score = 1
      else if (titleLower === q) score = 100
      else if (titleLower.startsWith(q)) score = 80
      else if (titleLower.includes(q)) score = 50
      else if (/[\u4e00-\u9fff]/.test(q) && [...q].every(ch => titleLower.includes(ch))) score = 30
      return { note, score }
    }).filter(x => x.score > 0)

    scored.sort((a, b) => b.score - a.score || b.note.updatedAt.localeCompare(a.note.updatedAt))
    return scored.slice(0, Math.min(100, Math.max(1, limit))).map(x => x.note)
  }

  backlinks(noteId: string): NoteMetadata[] {
    this.ensureIndex()
    const meta = this.fileManager.getMetadata()
    const needle = `arknote-link://${noteId}`
    const results: NoteMetadata[] = []
    for (const note of meta.notes) {
      if (note.id === noteId) continue
      try {
        const cached = this.getOrCreateCachedEntry(note.id)
        if (cached.content.includes(needle)) results.push(note)
      } catch {
        // skip
      }
    }
    return results
  }

  inNote(noteId: string, query: string): SearchMatch[] {
    if (!query.trim()) return []

    const rawContent = this.fileManager.readNoteContent(noteId)
    let cleaned = rawContent.replace(/```mermaid[\s\S]*?```/g, '')
    cleaned = cleaned.replace(/<[^>]*>/g, '')
    cleaned = cleaned.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    cleaned = cleaned.replace(/\[([^\]]*)\]\([^)]+\)/g, '$1')
    return this.findMatches(cleaned, query, query.toLowerCase())
  }

  private getOrCreateCachedEntry(noteId: string): CachedSearchEntry {
    const cached = this.globalSearchCache.get(noteId)
    if (cached) return cached
    this.upsertNote(noteId)
    const refreshed = this.globalSearchCache.get(noteId)
    if (!refreshed) throw new Error(`Search cache entry not found for note: ${noteId}`)
    return refreshed
  }

  private findMatches(content: string, query: string, lowerQuery: string, limit?: number): SearchMatch[] {
    const matches: SearchMatch[] = []
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineLower = line.toLowerCase()
      let searchStart = 0

      while (true) {
        const idx = lineLower.indexOf(lowerQuery, searchStart)
        if (idx === -1) break

        const contextStart = Math.max(0, i - 1)
        const contextEnd = Math.min(lines.length - 1, i + 1)
        const context = lines.slice(contextStart, contextEnd + 1).join('\n')

        matches.push({
          line: i + 1,
          column: idx,
          length: query.length,
          text: line.substring(idx, idx + query.length),
          context,
        })

        if (limit && matches.length >= limit) return matches
        searchStart = idx + 1
      }
    }

    return matches
  }

  private getDirectoryPath(directoryId: string): string {
    const meta = this.fileManager.getMetadata()
    const parts: string[] = []
    let currentId: string | null = directoryId

    while (currentId) {
      const dir = meta.directories.find(d => d.id === currentId)
      if (!dir) break
      parts.unshift(dir.name)
      currentId = dir.parentId
    }

    return parts.join(' / ') || '根目录'
  }
}
