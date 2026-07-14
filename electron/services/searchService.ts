import { FileManager } from './fileManager'
import type { SearchResult, SearchMatch } from '../../src/types'

const MAX_GLOBAL_MATCHES_PER_NOTE = 3
const DEFAULT_GLOBAL_TOTAL_LIMIT = 20

type CachedSearchEntry = {
  noteId: string
  title: string
  titleLower: string
  directoryId: string
  content: string
}

const MAX_SEARCH_CACHE_ENTRIES = 200

export class SearchService {
  private fileManager: FileManager
  private globalSearchCache: Map<string, CachedSearchEntry> = new Map()
  private searchCacheOrder: string[] = []

  constructor(fileManager: FileManager) {
    this.fileManager = fileManager
  }

  clearCache(): void {
    this.globalSearchCache.clear()
    this.searchCacheOrder.length = 0
  }

  removeNote(noteId: string): void {
    this.globalSearchCache.delete(noteId)
    const idx = this.searchCacheOrder.indexOf(noteId)
    if (idx >= 0) this.searchCacheOrder.splice(idx, 1)
  }

  upsertNote(noteId: string): void {
    const meta = this.fileManager.getMetadata()
    const note = meta.notes.find(n => n.id === noteId)
    if (!note) {
      this.removeNote(noteId)
      return
    }

    // LRU eviction
    if (!this.globalSearchCache.has(noteId) && this.searchCacheOrder.length >= MAX_SEARCH_CACHE_ENTRIES) {
      const oldest = this.searchCacheOrder.shift()!
      this.globalSearchCache.delete(oldest)
    }

    this.globalSearchCache.set(noteId, {
      noteId,
      title: note.title,
      titleLower: note.title.toLowerCase(),
      directoryId: note.directoryId,
      content: this.fileManager.readNoteContent(noteId),
    })

    // Move to end (most recently used)
    const idx = this.searchCacheOrder.indexOf(noteId)
    if (idx >= 0) this.searchCacheOrder.splice(idx, 1)
    this.searchCacheOrder.push(noteId)
  }

  /**
   * Global search across all notes or within specified directories
   */
  global(query: string, directoryIds?: string[], totalLimit: number = DEFAULT_GLOBAL_TOTAL_LIMIT): SearchResult[] {
    if (!query.trim()) return []

    const meta = this.fileManager.getMetadata()
    let notes = meta.notes

    // Filter by directories if specified
    if (directoryIds && directoryIds.length > 0) {
      // Get all sub-directory IDs recursively
      const allDirIds = new Set<string>()
      const addSubDirs = (dirId: string) => {
        allDirIds.add(dirId)
        const subDirs = meta.directories.filter(d => d.parentId === dirId)
        subDirs.forEach(d => addSubDirs(d.id))
      }
      directoryIds.forEach(id => addSubDirs(id))

      notes = notes.filter(n => allDirIds.has(n.directoryId))
    }

    const results: SearchResult[] = []
    const lowerQuery = query.toLowerCase()

    for (const note of notes) {
      try {
        const cached = this.getOrCreateCachedEntry(note.id)
        const matches = this.findMatches(cached.content, query, lowerQuery, MAX_GLOBAL_MATCHES_PER_NOTE)

        const titleIdx = cached.titleLower.indexOf(lowerQuery)
        if (titleIdx !== -1) {
          matches.unshift({
            line: 0,
            column: titleIdx,
            length: query.length,
            text: query,
            context: `[标题] ${cached.title}`,
          })
        }

        const limitedMatches = matches.slice(0, MAX_GLOBAL_MATCHES_PER_NOTE)

        if (limitedMatches.length > 0) {
          results.push({
            noteId: note.id,
            noteTitle: cached.title,
            directoryId: cached.directoryId,
            directoryPath: this.getDirectoryPath(cached.directoryId),
            matches: limitedMatches,
          })

          if (results.length >= totalLimit) {
            break
          }
        }
      } catch {
        this.globalSearchCache.delete(note.id)
        continue
      }
    }

    return results
  }

  /**
   * Search within a specific note.
   * HTML tags, markdown link/image URLs, and mermaid fenced code blocks
   * are stripped before matching so that invisible content is not counted.
   */
  inNote(noteId: string, query: string): SearchMatch[] {
    if (!query.trim()) return []

    const rawContent = this.fileManager.readNoteContent(noteId)
    // Strip mermaid fenced code blocks (replaced by SVG at render time)
    let cleaned = rawContent.replace(/```mermaid[\s\S]*?```/g, '')
    // Strip HTML tags
    cleaned = cleaned.replace(/<[^>]*>/g, '')
    // Strip markdown image URLs: ![alt](url) → alt
    cleaned = cleaned.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // Strip markdown link URLs: [text](url) → text
    cleaned = cleaned.replace(/\[([^\]]*)\]\([^)]+\)/g, '$1')
    return this.findMatches(cleaned, query, query.toLowerCase())
  }

  private getOrCreateCachedEntry(noteId: string): CachedSearchEntry {
    const cached = this.globalSearchCache.get(noteId)
    if (cached) {
      return cached
    }

    this.upsertNote(noteId)
    const refreshed = this.globalSearchCache.get(noteId)
    if (!refreshed) {
      throw new Error(`Search cache entry not found for note: ${noteId}`)
    }
    return refreshed
  }

  /**
   * Find all matches of query in content
   */
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

        // Build context: show the line with surrounding context
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

        if (limit && matches.length >= limit) {
          return matches
        }

        searchStart = idx + 1
      }
    }

    return matches
  }

  /**
   * Build the full directory path string
   */
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
