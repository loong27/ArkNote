import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import ReactDOM from 'react-dom'
import { Edit3, Eye, Save, ChevronRight, X } from 'lucide-react'
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
// @ts-ignore - no types for markdown-it-task-lists
import taskLists from 'markdown-it-task-lists'
import mermaid from 'mermaid'
import { useStore } from '../../store/useStore'
import { NoteEditor } from './NoteEditor'
import type { NoteEditorHandle } from './NoteEditor'
import { NoteMenu } from './NoteMenu'
import { SearchInNote } from './SearchInNote'
import { EditorToolbar } from './EditorToolbar'
import type { SearchMatch } from '../../types'
import { EditorView } from '@codemirror/view'

// Initialize markdown-it with HTML support + task lists
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true,
})

// Add task list support (- [ ] / - [x])
md.use(taskLists, { enabled: true, label: true, labelAfter: true })

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'strict',
  fontFamily: 'var(--font-sans)',
})

// Session-level image data URL cache with LRU eviction — avoids re-fetching
// and re-decrypting images when re-opening notes. Limited to prevent memory bloat.
const IMAGE_CACHE_MAX = 50
const PREVIEW_CACHE_MAX = 20
const imageUrlCache = new Map<string, string>()
const imageCacheOrder: string[] = []
const previewHtmlCache = new Map<string, string>()
const previewCacheOrder: string[] = []

function cacheImageUrl(id: string, url: string): void {
  if (imageUrlCache.has(id)) {
    imageCacheOrder.splice(imageCacheOrder.indexOf(id), 1)
  } else if (imageCacheOrder.length >= IMAGE_CACHE_MAX) {
    const oldest = imageCacheOrder.shift()!
    imageUrlCache.delete(oldest)
  }
  imageUrlCache.set(id, url)
  imageCacheOrder.push(id)
}

function hashContent(content: string): string {
  let hash = 2166136261
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function getPreviewCacheKey(noteId: string, content: string): string {
  return `${noteId}:${content.length}:${hashContent(content)}`
}

function getCachedPreviewHtml(key: string): string | null {
  const html = previewHtmlCache.get(key)
  if (html === undefined) return null
  const index = previewCacheOrder.indexOf(key)
  if (index >= 0) {
    previewCacheOrder.splice(index, 1)
  }
  previewCacheOrder.push(key)
  return html
}

function cachePreviewHtml(key: string, html: string): void {
  if (previewHtmlCache.has(key)) {
    const index = previewCacheOrder.indexOf(key)
    if (index >= 0) {
      previewCacheOrder.splice(index, 1)
    }
  } else if (previewCacheOrder.length >= PREVIEW_CACHE_MAX) {
    const oldest = previewCacheOrder.shift()!
    previewHtmlCache.delete(oldest)
  }
  previewHtmlCache.set(key, html)
  previewCacheOrder.push(key)
}

// Exposed so the store can clear on lock/vault reset
;(window as any).__clearImageCache = () => {
  imageUrlCache.clear()
  imageCacheOrder.length = 0
  previewHtmlCache.clear()
  previewCacheOrder.length = 0
}

const leadingTitleRegex = /^(\s*)#\s+[^\n#].*?(?:\s+#*)?\s*(\r?\n|$)/
const leadingTitleCaptureRegex = /^\s*#\s+([^\n#].*?)(?:\s+#*)?\s*(?:\r?\n|$)/

function getLeadingMarkdownTitle(markdown: string): string | null {
  return leadingTitleCaptureRegex.exec(markdown)?.[1]?.trim() || null
}

function setLeadingMarkdownTitle(markdown: string, noteTitle: string): string {
  const titleLine = `# ${noteTitle.trim() || '无标题'}`
  if (leadingTitleRegex.test(markdown)) {
    return markdown.replace(leadingTitleRegex, (_match, leading, lineEnd) => `${leading}${titleLine}${lineEnd}`)
  }
  return `${titleLine}\n\n${markdown}`
}

function sanitizeRenderedHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['details', 'summary'],
    ADD_ATTR: ['target', 'rel', 'class', 'data-note-id', 'checked', 'width', 'height', 'data-zznote-image-id', 'data-zznote-width', 'data-zznote-height'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|data:image\/|zznote:\/\/|zznote-link:\/\/|#)/i,
  })
}

function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ['foreignObject'],
    ADD_ATTR: ['dominant-baseline', 'marker-end', 'marker-start'],
  })
}

function getSafeDimension(value: string | null): string | null {
  const trimmed = value?.trim()
  return trimmed && /^\d{1,4}$/.test(trimmed) ? trimmed : null
}

function applyImageDimensionAttributes(html: string): string {
  const template = document.createElement('template')
  template.innerHTML = html

  for (const img of Array.from(template.content.querySelectorAll('img[data-zznote-image-id]'))) {
    const width = getSafeDimension(img.getAttribute('data-zznote-width'))
    const height = getSafeDimension(img.getAttribute('data-zznote-height'))
    if (width) img.setAttribute('width', width)
    if (height) img.setAttribute('height', height)
    img.removeAttribute('data-zznote-width')
    img.removeAttribute('data-zznote-height')
  }

  return template.innerHTML
}

export const NoteView: React.FC = () => {
  // Granular store selectors — only re-render when the specific slice changes
  const currentNote = useStore(s => s.currentNote)
  const isTrashNote = useStore(s => s.isTrashNote)
  const isEditing = useStore(s => s.isEditing)
  const noteSearchVisible = useStore(s => s.noteSearchVisible)
  const noteSearchQuery = useStore(s => s.noteSearchQuery)
  const tags = useStore(s => s.tags)
  const theme = useStore(s => s.theme)
  const saveState = useStore(s => s.saveState)
  // Actions are stable references, no re-render risk
  const {
    setIsEditing,
    setNoteSearchVisible,
    getDirectoryPathParts,
    loadData,
    openNote,
    markNoteDirty,
    markSaveStarted,
    markSaveSucceeded,
    markSaveFailed,
    clearSaveError,
    registerSaveCoordinator,
  } = useStore()

  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const saveInFlightRef = useRef<Promise<void> | null>(null)
  const latestContentRef = useRef('')
  const [renderedHtml, setRenderedHtml] = useState('')
  const [searchHighlights, setSearchHighlights] = useState<SearchMatch[]>([])
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0)
  const [imagePopupSrc, setImagePopupSrc] = useState<string | null>(null)
  const [imagePopupAlt, setImagePopupAlt] = useState('')
  const previewRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<NoteEditorHandle>(null)
  const editorViewRef = useRef<EditorView | null>(null)

  // Update mermaid theme when app theme changes
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === 'dark' ? 'dark' : 'default',
      securityLevel: 'strict',
      fontFamily: 'var(--font-sans)',
    })
  }, [theme])

  // Keep editorViewRef in sync
  useEffect(() => {
    const interval = setInterval(() => {
      if (editorRef.current) {
        editorViewRef.current = editorRef.current.getEditorView()
      }
    }, 100)
    return () => clearInterval(interval)
  }, [isEditing])

  // If it's a trash note, force preview mode
  useEffect(() => {
    if (isTrashNote && isEditing) {
      setIsEditing(false)
    }
  }, [isTrashNote, isEditing, setIsEditing])

  // Build breadcrumb path
  const breadcrumbPath = useMemo(() => {
    if (!currentNote) return []
    return getDirectoryPathParts(currentNote.metadata.directoryId)
  }, [currentNote, getDirectoryPathParts])

  const sanitizedHtml = useMemo(
    () => applyImageDimensionAttributes(sanitizeRenderedHtml(renderedHtml)),
    [renderedHtml]
  )

  // Render markdown with image resolution, mermaid diagrams, etc.
  // Uses a cancellation flag to prevent stale async renders from overwriting newer results.
  // Search highlights are NOT applied here — they are applied via DOM walk in a separate effect.
  useEffect(() => {
    if (!currentNote || isEditing) return

    const cacheKey = getPreviewCacheKey(currentNote.id, content)
    const cachedHtml = getCachedPreviewHtml(cacheKey)
    if (cachedHtml !== null) {
      setRenderedHtml(cachedHtml)
      return
    }

    let cancelled = false
    const frame = requestAnimationFrame(() => {
      const renderAsync = async () => {
        let processedContent = content

        const mdImgRegex = /!\[([^\]]*)\]\(zznote:\/\/([^)]+)\)/g
        const htmlImgRegex = /<img\b[^>]*\bsrc="zznote:\/\/([^"]+)"[^>]*>/g
        const imageIds = new Set<string>()

        for (const match of processedContent.matchAll(mdImgRegex)) {
          imageIds.add(match[2])
        }
        for (const match of processedContent.matchAll(htmlImgRegex)) {
          imageIds.add(match[1])
        }

        if (imageIds.size > 0) {
          const entries = await Promise.all(
            Array.from(imageIds).map(async (id) => {
              if (imageUrlCache.has(id)) {
                return { id, dataUrl: imageUrlCache.get(id)! }
              }
              try {
                const dataUrl = await window.electronAPI.images.get(id)
                if (dataUrl) {
                  cacheImageUrl(id, dataUrl)
                  return { id, dataUrl }
                }
              } catch {
              }
              return { id, dataUrl: null as string | null }
            })
          )

          if (cancelled) return

          const dataUrlMap = new Map(entries.map((e) => [e.id, e.dataUrl]))

          processedContent = processedContent.replace(mdImgRegex, (full, alt, id) => {
            const url = dataUrlMap.get(id)
            return url ? `![${alt}](${url})` : full
          })

          processedContent = processedContent.replace(htmlImgRegex, (full, id) => {
            const url = dataUrlMap.get(id)
            if (!url) return full

            const width = getSafeDimension(/\bwidth="([^"]+)"/i.exec(full)?.[1] ?? null)
            const height = getSafeDimension(/\bheight="([^"]+)"/i.exec(full)?.[1] ?? null)
            let next = full.replace(`src="zznote://${id}"`, `src="${url}"`)
            next = next.replace(/\sdata-zznote-image-id="[^"]*"/i, '')
            next = next.replace(/\sdata-zznote-width="[^"]*"/i, '')
            next = next.replace(/\sdata-zznote-height="[^"]*"/i, '')
            next = next.replace(/<img\b/i, `<img data-zznote-image-id="${id}"${width ? ` data-zznote-width="${width}"` : ''}${height ? ` data-zznote-height="${height}"` : ''}`)
            return next
          })
        }

        if (cancelled) return

        const noteLinkRegex = /\[([^\]]*)\]\(zznote-link:\/\/([^)]+)\)/g
        processedContent = processedContent.replace(noteLinkRegex, (_match, text, noteId) => {
          return `<a href="#" class="note-internal-link" data-note-id="${noteId}">${text}</a>`
        })

        if (cancelled) return
        const html = md.render(processedContent)
        cachePreviewHtml(cacheKey, html)
        setRenderedHtml(html)
      }

      renderAsync()
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [content, currentNote, isEditing])

  // Apply search highlights via DOM text-node walking.
  // This avoids the HTML-corruption bug where single-char regex queries
  // like /(s)/gi match inside HTML tag names and break the DOM.
  useEffect(() => {
    const preview = previewRef.current
    if (!preview || isEditing) return

    const existingMarks = preview.querySelectorAll('mark.search-highlight')
    const shouldHighlight = noteSearchVisible && noteSearchQuery && searchHighlights.length > 0
    if (!shouldHighlight) {
      if (existingMarks.length === 0) return
      for (const mark of existingMarks) {
        mark.replaceWith(document.createTextNode(mark.textContent || ''))
      }
      preview.normalize()
      return
    }

    for (const mark of existingMarks) {
      mark.replaceWith(document.createTextNode(mark.textContent || ''))
    }
    preview.normalize()

    const query = noteSearchQuery
    const lowerQuery = query.toLowerCase()

    // Collect text nodes via TreeWalker, skipping non-text-content elements
    const walker = document.createTreeWalker(
      preview,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = (node as Text).parentElement
          if (!parent) return NodeFilter.FILTER_REJECT
          if (parent.closest('mark, script, style, .mermaid-container, code.language-mermaid')) {
            return NodeFilter.FILTER_REJECT
          }
          return NodeFilter.FILTER_ACCEPT
        },
      }
    )

    const textNodes: Text[] = []
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode as Text)
    }

    for (const textNode of textNodes) {
      const text = textNode.textContent || ''
      const lowerText = text.toLowerCase()
      if (!lowerText.includes(lowerQuery)) continue

      const fragment = document.createDocumentFragment()
      let lastIndex = 0
      let searchFrom = 0

      while (searchFrom < text.length) {
        const idx = lowerText.indexOf(lowerQuery, searchFrom)
        if (idx === -1) break

        if (idx > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, idx)))
        }

        const mark = document.createElement('mark')
        mark.className = 'search-highlight'
        mark.textContent = text.slice(idx, idx + query.length)
        fragment.appendChild(mark)

        lastIndex = idx + query.length
        searchFrom = lastIndex
      }

      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)))
      }

      textNode.parentNode?.replaceChild(fragment, textNode)
    }

    // Scroll to current match after highlights are applied
    if (currentSearchIndex >= 0) {
      const highlights = preview.querySelectorAll('.search-highlight')
      if (highlights[currentSearchIndex]) {
        highlights[currentSearchIndex].scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [renderedHtml, searchHighlights, currentSearchIndex, isEditing, noteSearchVisible, noteSearchQuery])

  // Render mermaid diagrams after HTML is set
  useEffect(() => {
    if (!previewRef.current || isEditing) return

    const renderMermaid = async () => {
      const codeBlocks = previewRef.current?.querySelectorAll('pre > code.language-mermaid')
      if (!codeBlocks || codeBlocks.length === 0) return

      const availableWidth = previewRef.current?.clientWidth ?? 800

      for (let i = 0; i < codeBlocks.length; i++) {
        const codeEl = codeBlocks[i]
        const preEl = codeEl.parentElement
        if (!preEl) continue

        const graphDefinition = codeEl.textContent || ''
        if (!graphDefinition.trim()) continue

        try {
          const id = `mermaid-${Date.now()}-${i}`
          const { svg } = await mermaid.render(id, graphDefinition)
          const container = document.createElement('div')
          container.className = 'mermaid-container'
          container.innerHTML = sanitizeSvg(svg)

          const svgEl = container.querySelector('svg')
          if (svgEl) {
            let svgWidth = 0
            const viewBox = svgEl.getAttribute('viewBox')
            if (viewBox) {
              const parts = viewBox.split(/[\s,]+/)
              svgWidth = parseFloat(parts[2]) || 0
            }
            if (!svgWidth) {
              const maxW = svgEl.style.maxWidth
              if (maxW) svgWidth = parseFloat(maxW) || 0
            }
            const padding = 96 + 32
            if (svgWidth > (availableWidth - padding) * 0.55) {
              container.classList.add('mermaid-full-width')
            }
          }

          preEl.replaceWith(container)
        } catch (err) {
          console.error('Mermaid render error:', err)
        }
      }
    }

    const timer = setTimeout(renderMermaid, 50)
    return () => clearTimeout(timer)
  }, [renderedHtml, isEditing])

  const closeImagePopup = useCallback(() => {
    setImagePopupSrc(null)
    setImagePopupAlt('')
  }, [])

  useEffect(() => {
    if (!imagePopupSrc) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeImagePopup()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [imagePopupSrc, closeImagePopup])

  // Handle clicking preview content: image popup + internal note links + external URLs
  useEffect(() => {
    const preview = previewRef.current
    if (!preview) return

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const img = target.closest('img') as HTMLImageElement | null
      if (img && preview.contains(img)) {
        const src = img.currentSrc || img.src
        if (src) {
          e.preventDefault()
          e.stopPropagation()
          setImagePopupSrc(src)
          setImagePopupAlt(img.alt || '')
        }
        return
      }

      const anchor = target.closest('a') as HTMLAnchorElement | null
      if (!anchor) return

      // Internal note link
      if (anchor.classList.contains('note-internal-link')) {
        e.preventDefault()
        e.stopPropagation()
        const noteId = anchor.getAttribute('data-note-id')
        if (noteId) {
          openNote(noteId)
        }
        return
      }

      // External URL: open in default browser
      const href = anchor.getAttribute('href')
      if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
        e.preventDefault()
        e.stopPropagation()
        window.electronAPI.window.openExternal(href)
      }
    }

    preview.addEventListener('click', handleClick)
    return () => preview.removeEventListener('click', handleClick)
  }, [openNote, isEditing])

  const flushCurrentNote = useCallback(async () => {
    if (!currentNote || isTrashNote) return

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    if (saveInFlightRef.current) {
      await saveInFlightRef.current
      return
    }

    const nextContent = latestContentRef.current
    const noteId = currentNote.id

    const savePromise = (async () => {
      markSaveStarted(noteId)
      try {
        await window.electronAPI.notes.update(noteId, nextContent)
        markSaveSucceeded(noteId)
      } catch (error) {
        const message = error instanceof Error ? error.message : '保存失败'
        markSaveFailed(noteId, message)
        throw error
      } finally {
        saveInFlightRef.current = null
      }
    })()

    saveInFlightRef.current = savePromise
    await savePromise
  }, [currentNote, isTrashNote, markSaveFailed, markSaveStarted, markSaveSucceeded])

  // Cleanup auto-save timer/coordinator on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
      registerSaveCoordinator(null)
    }
  }, [registerSaveCoordinator])

  useEffect(() => {
    registerSaveCoordinator({
      flush: flushCurrentNote,
      saveVersion: async () => {
        if (!currentNote || isTrashNote) return
        await flushCurrentNote()
        try {
          await window.electronAPI.versions.save(currentNote.id)
          markSaveSucceeded(currentNote.id)
        } catch (error) {
          const message = error instanceof Error ? error.message : '保存版本失败'
          markSaveFailed(currentNote.id, message)
          throw error
        }
      },
    })

    return () => registerSaveCoordinator(null)
  }, [currentNote, flushCurrentNote, isTrashNote, markSaveFailed, registerSaveCoordinator])

  // Auto-save with debounce (not for trash notes)
  const handleContentChange = useCallback((newContent: string) => {
    if (isTrashNote || !currentNote) return
    latestContentRef.current = newContent
    setContent(newContent)
    markNoteDirty(currentNote.id)
    clearSaveError()

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }

    saveTimerRef.current = setTimeout(() => {
      flushCurrentNote().catch(() => {})
    }, 2000)
  }, [clearSaveError, currentNote, flushCurrentNote, isTrashNote, markNoteDirty])

  // Sync content when note changes — use currentNote (not just id)
  // to ensure content is always up to date when the note object changes
  useEffect(() => {
    if (currentNote) {
      const syncedContent = !isTrashNote
        ? setLeadingMarkdownTitle(currentNote.content, currentNote.metadata.title)
        : currentNote.content
      setContent(syncedContent)
      latestContentRef.current = syncedContent
      setTitle(getLeadingMarkdownTitle(syncedContent) || currentNote.metadata.title)
      if (!isTrashNote && syncedContent !== currentNote.content) {
        handleContentChange(syncedContent)
      }
      // Reset scroll position when switching notes
      if (previewRef.current) {
        previewRef.current.scrollTop = 0
      }
    }
  }, [currentNote, isTrashNote, handleContentChange])

  // Manual save (Ctrl+S) - saves version
  const handleManualSave = useCallback(async () => {
    if (!currentNote || isTrashNote) return

    try {
      await flushCurrentNote()
      await window.electronAPI.versions.save(currentNote.id)
      markSaveSucceeded(currentNote.id)
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存版本失败'
      markSaveFailed(currentNote.id, message)
    }
  }, [currentNote, flushCurrentNote, isTrashNote, markSaveFailed, markSaveSucceeded])

  // Handle title change (not for trash notes)
  const handleTitleChange = useCallback(async (newTitle: string) => {
    if (isTrashNote) return
    setTitle(newTitle)
    if (currentNote) {
      const nextContent = setLeadingMarkdownTitle(latestContentRef.current, newTitle)
      setContent(nextContent)
      latestContentRef.current = nextContent
      markNoteDirty(currentNote.id)
      clearSaveError()

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
      saveTimerRef.current = setTimeout(() => {
        flushCurrentNote().catch(() => {})
      }, 2000)

      try {
        await window.electronAPI.notes.updateTitle(currentNote.id, newTitle)
        await loadData()
      } catch (error) {
        const message = error instanceof Error ? error.message : '标题保存失败'
        markSaveFailed(currentNote.id, message)
      }
    }
  }, [clearSaveError, currentNote, flushCurrentNote, isTrashNote, loadData, markNoteDirty, markSaveFailed])

  // Handle image upload - insert as HTML <img> for resizability
  const handleImageUpload = useCallback(async () => {
    if (!currentNote || isTrashNote) return

    try {
      const imageId = await window.electronAPI.images.selectAndSave(currentNote.id)
      if (imageId) {
        const imageHtml = `\n<img src="zznote://${imageId}" alt="image" width="600" />\n`
        const newContent = content + imageHtml
        setContent(newContent)
        handleContentChange(newContent)
      }
    } catch (error) {
      console.error('Image upload failed:', error)
    }
  }, [currentNote, content, handleContentChange, isTrashNote])

  // Handle search highlight results from SearchInNote
  const handleSearchHighlight = useCallback((matches: SearchMatch[], currentIndex: number) => {
    setSearchHighlights(matches)
    setCurrentSearchIndex(currentIndex)
  }, [])

  // Keyboard shortcut: Ctrl+F for search in note
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault()
        setNoteSearchVisible(!noteSearchVisible)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [noteSearchVisible, setNoteSearchVisible])

  // Get note tags
  const noteTags = useMemo(() => {
    if (!currentNote) return []
    return tags.filter(t => currentNote.metadata.tags.includes(t.id))
  }, [currentNote, tags])

  if (!currentNote) return null

  const noteActions = (
    <div className="note-actions">
      {!isTrashNote && (
        <button className="icon-btn" onClick={handleManualSave} data-tooltip="保存版本 (Ctrl+S)">
          <Save size={18} strokeWidth={1.5} />
        </button>
      )}

      {!isTrashNote && saveState.noteId === currentNote.id && saveState.phase !== 'idle' && (
        <span className={`note-save-status ${saveState.phase === 'error' ? 'error' : ''}`}>
          {saveState.phase === 'dirty' && '未保存'}
          {saveState.phase === 'saving' && '保存中...'}
          {saveState.phase === 'saved' && '已保存'}
          {saveState.phase === 'error' && `保存失败：${saveState.errorMessage || '请重试'}`}
        </span>
      )}

      {!isTrashNote && (
        <div className="mode-toggle">
          <button
            className={isEditing ? 'active' : ''}
            onClick={() => setIsEditing(true)}
          >
            <Edit3 size={14} strokeWidth={1.5} style={{ marginRight: 4 }} />
            编辑
          </button>
          <button
            className={!isEditing ? 'active' : ''}
            onClick={() => {
              setIsEditing(false)
              flushCurrentNote().catch(() => {})
            }}
          >
            <Eye size={14} strokeWidth={1.5} style={{ marginRight: 4 }} />
            预览
          </button>
        </div>
      )}

      <NoteMenu noteId={currentNote.id} htmlContent={renderedHtml} trashMode={isTrashNote} />
    </div>
  )

  return (
    <div className="note-view">
      {isTrashNote && (
        <div className="note-toolbar">
          <div className="note-toolbar-left">
            {/* Breadcrumb path */}
            <span className="breadcrumb-item trash-badge">回收站</span>
            {breadcrumbPath.length === 0 && (
              <ChevronRight size={12} strokeWidth={1.5} className="breadcrumb-separator" />
            )}
            {breadcrumbPath.map((item, index) => (
              <React.Fragment key={item.id}>
                {(index > 0 || isTrashNote) && <ChevronRight size={12} strokeWidth={1.5} className="breadcrumb-separator" />}
                <span className="breadcrumb-item">{item.name}</span>
              </React.Fragment>
            ))}
            {breadcrumbPath.length > 0 && <ChevronRight size={12} strokeWidth={1.5} className="breadcrumb-separator" />}

            {/* Title inline */}
            <input
              className="note-title-input"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="无标题"
              readOnly
            />

            {/* Note tags */}
            {noteTags.length > 0 && (
              <div className="note-tags">
                {noteTags.map(tag => (
                  <span
                    key={tag.id}
                    className="note-tag-badge"
                    style={{ backgroundColor: `${tag.color}33`, border: `1px solid ${tag.color}` }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="note-toolbar-right">{noteActions}</div>
        </div>
      )}

      {!isTrashNote && (
        isEditing ? (
          <EditorToolbar
            editorViewRef={editorViewRef}
            onImageUpload={handleImageUpload}
            rightActions={<div className="note-inline-actions editor-note-actions">{noteActions}</div>}
          />
        ) : (
          <div className="preview-toolbar">
            <div className="preview-toolbar-actions">
              <div className="note-inline-actions editor-note-actions">{noteActions}</div>
            </div>
          </div>
        )
      )}

      {/* Search in note (floating, top-right) */}
      <SearchInNote onHighlight={handleSearchHighlight} />

      {/* Note body */}
      <div className={`note-body ${!isEditing || isTrashNote ? 'preview-note-body' : ''}`}>
        {isEditing && !isTrashNote ? (
          <NoteEditor
            ref={editorRef}
            content={content}
            onChange={handleContentChange}
            onSave={handleManualSave}
          />
        ) : (
          <div
            ref={previewRef}
            className="markdown-preview"
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
          />
        )}
      </div>

      {imagePopupSrc && ReactDOM.createPortal(
        <div className="image-lightbox-overlay" onClick={closeImagePopup}>
          <button className="image-lightbox-close" onClick={closeImagePopup} aria-label="关闭原图预览">
            <X size={22} strokeWidth={1.8} />
          </button>
          <div className="image-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={imagePopupSrc} alt={imagePopupAlt || '原图预览'} />
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
