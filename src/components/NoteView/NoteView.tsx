import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import ReactDOM from 'react-dom'
import { Columns2, Edit3, Eye, Save, ChevronRight, X, Copy, Check, Pin, Paperclip, ListTree } from 'lucide-react'
import DOMPurify from 'dompurify'
import mermaid from 'mermaid'
import { useStore } from '../../store/useStore'
import { NoteEditor } from './NoteEditor'
import { NoteMenu } from './NoteMenu'
import { NoteTagBar } from './NoteTagBar'
import { SearchInNote } from './SearchInNote'
import { EditorToolbar } from './EditorToolbar'
import { BackToTopButton } from './BackToTopButton'
import type { SearchMatch } from '../../types'
import { EditorView } from '@codemirror/view'
import { migrateLegacyBrandReferences } from '../../../shared/brand'
import { useI18n } from '../../i18n/I18nProvider'
import { copyArkNoteImageToClipboard, copyImageToClipboard } from '../../utils/copyImage'
import { writeClipboardText } from '../../utils/clipboard'
import { getLanguageLabel } from '../../utils/codeLanguages'
import { renderMarkdown } from '../../utils/markdownRenderer'
import { ImageContextMenu } from './ImageContextMenu'

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

function setLeadingMarkdownTitle(markdown: string, noteTitle: string, untitled: string): string {
  const titleLine = `# ${noteTitle.trim() || untitled}`
  if (leadingTitleRegex.test(markdown)) {
    return markdown.replace(leadingTitleRegex, (_match, leading, lineEnd) => `${leading}${titleLine}${lineEnd}`)
  }
  return `${titleLine}\n\n${markdown}`
}

function sanitizeRenderedHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['details', 'summary'],
    ADD_ATTR: [
      'target', 'rel', 'class', 'data-note-id', 'checked', 'width', 'height',
      'data-arknote-image-id', 'data-arknote-width', 'data-arknote-height', 'data-lang',
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|data:image\/|arknote:\/\/|arknote-link:\/\/|#)/i,
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

  for (const img of Array.from(template.content.querySelectorAll('img[data-arknote-image-id]'))) {
    const width = getSafeDimension(img.getAttribute('data-arknote-width'))
    const height = getSafeDimension(img.getAttribute('data-arknote-height'))
    if (width) img.setAttribute('width', width)
    if (height) img.setAttribute('height', height)
    img.removeAttribute('data-arknote-width')
    img.removeAttribute('data-arknote-height')
  }

  return template.innerHTML
}

export const NoteView: React.FC = () => {
  const { t } = useI18n()
  // Granular store selectors — only re-render when the specific slice changes
  const currentNote = useStore(s => s.currentNote)
  const isTrashNote = useStore(s => s.isTrashNote)
  const isEditing = useStore(s => s.isEditing)
  const noteSearchVisible = useStore(s => s.noteSearchVisible)
  const noteSearchQuery = useStore(s => s.noteSearchQuery)
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
  const [livePreview, setLivePreview] = useState(true)
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const saveInFlightRef = useRef<Promise<void> | null>(null)
  const latestContentRef = useRef('')
  const appliedNoteIdRef = useRef<string | null>(null)
  const appliedStoreContentRef = useRef<string | null>(null)
  const [renderedHtml, setRenderedHtml] = useState('')
  const [searchHighlights, setSearchHighlights] = useState<SearchMatch[]>([])
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0)
  const [imagePopupSrc, setImagePopupSrc] = useState<string | null>(null)
  const [imagePopupAlt, setImagePopupAlt] = useState('')
  const [imageCopyState, setImageCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const imageCopyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [imageContextMenu, setImageContextMenu] = useState<{
    x: number
    y: number
    source: string
  } | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  /** Actual vertical scrollport for preview content (not the flex shell). */
  const previewScrollRef = useRef<HTMLDivElement>(null)
  const editorViewRef = useRef<EditorView | null>(null)
  const [editorReadyTick, setEditorReadyTick] = useState(0)
  const [outline, setOutline] = useState<Array<{ level: number; text: string; line: number }>>([])
  const [backlinks, setBacklinks] = useState<Array<{ id: string; title: string }>>([])
  const [showOutline, setShowOutline] = useState(true)
  const [editorFontSize, setEditorFontSize] = useState(16)
  const [pinned, setPinned] = useState(false)
  const showEditor = isEditing && !isTrashNote
  const showPreview = isTrashNote || !isEditing || livePreview
  const isSplitView = showEditor && showPreview

  useEffect(() => {
    void window.electronAPI.notesExtras.getEditorPrefs().then((prefs) => {
      setEditorFontSize(prefs.fontSize)
      if (!isTrashNote) {
        if (prefs.defaultView === 'edit') {
          setIsEditing(true)
          setLivePreview(false)
        } else if (prefs.defaultView === 'preview') {
          setIsEditing(false)
        } else {
          setIsEditing(true)
          setLivePreview(true)
        }
      }
    }).catch(() => undefined)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!currentNote || isTrashNote) {
      setOutline([])
      setBacklinks([])
      return
    }
    void window.electronAPI.notesExtras.getOutline(currentNote.id).then(setOutline).catch(() => setOutline([]))
    void window.electronAPI.search.backlinks(currentNote.id)
      .then(notes => setBacklinks(notes.map(n => ({ id: n.id, title: n.title }))))
      .catch(() => setBacklinks([]))
    void window.electronAPI.notesExtras.getPinned().then(ids => setPinned(ids.includes(currentNote.id)))
  }, [currentNote?.id, content, isTrashNote])

  // Update mermaid theme when app theme changes
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === 'dark' ? 'dark' : 'default',
      securityLevel: 'strict',
      fontFamily: 'var(--font-sans)',
    })
  }, [theme])

  const handleEditorReady = useCallback((view: EditorView | null) => {
    editorViewRef.current = view
    setEditorReadyTick((tick) => tick + 1)
  }, [])

  // Bi-directional scroll sync between editor and preview in split mode
  useEffect(() => {
    if (!isSplitView) return

    const editorScroller = editorViewRef.current?.scrollDOM
    const previewScroller = previewScrollRef.current
    if (!editorScroller || !previewScroller) return

    let syncing = false
    let rafId = 0
    let activeSide: 'editor' | 'preview' | null = null
    let clearActiveTimer = 0

    const maxScroll = (el: HTMLElement) => el.scrollHeight - el.clientHeight

    const scrollRatio = (el: HTMLElement) => {
      const max = maxScroll(el)
      return max <= 0 ? 0 : el.scrollTop / max
    }

    const applyRatio = (el: HTMLElement, ratio: number) => {
      const max = maxScroll(el)
      if (max <= 0) return
      el.scrollTop = ratio * max
    }

    const markActive = (side: 'editor' | 'preview') => {
      activeSide = side
      if (clearActiveTimer) window.clearTimeout(clearActiveTimer)
      clearActiveTimer = window.setTimeout(() => {
        activeSide = null
        clearActiveTimer = 0
      }, 120)
    }

    const syncFrom = (
      source: HTMLElement,
      target: HTMLElement,
      side: 'editor' | 'preview',
    ) => {
      if (syncing) return
      // Ignore echo from the opposite pane while this side is driving.
      if (activeSide && activeSide !== side) return
      // Non-scrollable source would report ratio 0 and yank the target to top.
      if (maxScroll(source) <= 0) return

      markActive(side)
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        rafId = 0
        syncing = true
        applyRatio(target, scrollRatio(source))
        // Release after the browser has applied scrollTop so the paired
        // scroll event (if any) is ignored.
        requestAnimationFrame(() => {
          syncing = false
        })
      })
    }

    const onEditorScroll = () => syncFrom(editorScroller, previewScroller, 'editor')
    const onPreviewScroll = () => syncFrom(previewScroller, editorScroller, 'preview')

    editorScroller.addEventListener('scroll', onEditorScroll, { passive: true })
    previewScroller.addEventListener('scroll', onPreviewScroll, { passive: true })

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      if (clearActiveTimer) window.clearTimeout(clearActiveTimer)
      editorScroller.removeEventListener('scroll', onEditorScroll)
      previewScroller.removeEventListener('scroll', onPreviewScroll)
    }
  }, [isSplitView, editorReadyTick])

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
    if (!currentNote || !showPreview) return

    const cacheKey = getPreviewCacheKey(currentNote.id, content)
    const cachedHtml = getCachedPreviewHtml(cacheKey)
    if (cachedHtml !== null) {
      setRenderedHtml(cachedHtml)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      const renderAsync = async () => {
        let processedContent = migrateLegacyBrandReferences(content)

        const mdImgRegex = /!\[([^\]]*)\]\(arknote:\/\/([^)]+)\)/g
        const htmlImgRegex = /<img\b[^>]*\bsrc="arknote:\/\/([^"]+)"[^>]*>/g
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
            let next = full.replace(`src="arknote://${id}"`, `src="${url}"`)
            next = next.replace(/\sdata-arknote-image-id="[^"]*"/i, '')
            next = next.replace(/\sdata-arknote-width="[^"]*"/i, '')
            next = next.replace(/\sdata-arknote-height="[^"]*"/i, '')
            next = next.replace(/<img\b/i, `<img data-arknote-image-id="${id}"${width ? ` data-arknote-width="${width}"` : ''}${height ? ` data-arknote-height="${height}"` : ''}`)
            return next
          })
        }

        if (cancelled) return

        const noteById = useStore.getState().noteById
        const noteLinkRegex = /\[([^\]]*)\]\(arknote-link:\/\/([^)]+)\)/g
        processedContent = processedContent.replace(noteLinkRegex, (_match, text, noteId) => {
          const exists = noteById.has(noteId)
          const brokenClass = exists ? '' : ' note-link-broken'
          return `<a href="#" class="note-internal-link${brokenClass}" data-note-id="${noteId}"${exists ? '' : ' title="链接目标不存在"'}>${text}</a>`
        })

        // Attachments
        processedContent = processedContent.replace(
          /\[([^\]]*)\]\(arknote-file:\/\/([a-f0-9-]{36})\)/gi,
          (_m, text, id) => `<a href="#" class="note-attachment-link" data-attachment-id="${id}">${text}</a>`,
        )

        if (cancelled) return
        const html = renderMarkdown(processedContent)
        cachePreviewHtml(cacheKey, html)
        setRenderedHtml(html)
      }

      renderAsync()
    }, isEditing ? 80 : 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [content, currentNote, isEditing, showPreview])

  // Apply search highlights via DOM text-node walking.
  // This avoids the HTML-corruption bug where single-char regex queries
  // like /(s)/gi match inside HTML tag names and break the DOM.
  useEffect(() => {
    const preview = previewRef.current
    if (!preview || !showPreview) return

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
  }, [renderedHtml, searchHighlights, currentSearchIndex, showPreview, noteSearchVisible, noteSearchQuery])

  // Localize plain-text labels and attach copy buttons to fenced code blocks
  useEffect(() => {
    if (!previewRef.current || !showPreview) return

    const blocks = previewRef.current.querySelectorAll('.md-code-block')
    for (const block of Array.from(blocks)) {
      const lang = block.getAttribute('data-lang') || ''
      const langEl = block.querySelector('.md-code-lang')
      if (langEl && (!lang || lang === 'plain')) {
        langEl.textContent = t('纯文本')
      }

      let header = block.querySelector('.md-code-header')
      if (!header) {
        header = document.createElement('div')
        header.className = 'md-code-header'
        const label = document.createElement('span')
        label.className = 'md-code-lang'
        label.textContent = !lang || lang === 'plain' ? t('纯文本') : getLanguageLabel(lang)
        header.appendChild(label)
        block.insertBefore(header, block.firstChild)
      }

      if (header.querySelector('[data-code-copy]')) continue

      const copyBtn = document.createElement('button')
      copyBtn.type = 'button'
      copyBtn.className = 'md-code-copy'
      copyBtn.setAttribute('data-code-copy', '1')
      copyBtn.setAttribute('aria-label', t('复制代码'))
      copyBtn.textContent = t('复制代码')
      header.appendChild(copyBtn)
    }
  }, [renderedHtml, showPreview, t])

  // Render mermaid diagrams after HTML is set
  useEffect(() => {
    if (!previewRef.current || !showPreview) return

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
  }, [renderedHtml, showPreview])

  const closeImagePopup = useCallback(() => {
    setImagePopupSrc(null)
    setImagePopupAlt('')
    setImageCopyState('idle')
    if (imageCopyResetRef.current) {
      clearTimeout(imageCopyResetRef.current)
      imageCopyResetRef.current = null
    }
  }, [])

  const copyImagePopup = useCallback(async () => {
    if (!imagePopupSrc) return

    const flashState = (state: 'copied' | 'failed') => {
      setImageCopyState(state)
      if (imageCopyResetRef.current) clearTimeout(imageCopyResetRef.current)
      imageCopyResetRef.current = setTimeout(() => {
        setImageCopyState('idle')
        imageCopyResetRef.current = null
      }, 1600)
    }

    const ok = await copyImageToClipboard(imagePopupSrc)
    flashState(ok ? 'copied' : 'failed')
  }, [imagePopupSrc])

  useEffect(() => {
    if (!imagePopupSrc) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeImagePopup()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        void copyImagePopup()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [imagePopupSrc, closeImagePopup, copyImagePopup])

  useEffect(() => {
    return () => {
      if (imageCopyResetRef.current) clearTimeout(imageCopyResetRef.current)
    }
  }, [])

  // Handle clicking preview content: code copy + image popup + internal note links + external URLs
  useEffect(() => {
    const preview = previewRef.current
    if (!preview) return

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement

      const copyBtn = target.closest('[data-code-copy]') as HTMLButtonElement | null
      if (copyBtn && preview.contains(copyBtn)) {
        e.preventDefault()
        e.stopPropagation()
        const block = copyBtn.closest('.md-code-block')
        const codeEl = block?.querySelector('pre code')
        const text = codeEl?.textContent ?? ''
        void (async () => {
          const ok = await writeClipboardText(text)
          const prev = copyBtn.textContent
          copyBtn.textContent = ok ? t('已复制') : t('复制失败')
          copyBtn.classList.toggle('is-success', ok)
          window.setTimeout(() => {
            copyBtn.textContent = prev || t('复制代码')
            copyBtn.classList.remove('is-success')
          }, 1600)
        })()
        return
      }

      const img = target.closest('img') as HTMLImageElement | null
      if (img && preview.contains(img)) {
        const src = img.currentSrc || img.src
        if (src) {
          e.preventDefault()
          e.stopPropagation()
          setImageContextMenu(null)
          setImageCopyState('idle')
          if (imageCopyResetRef.current) {
            clearTimeout(imageCopyResetRef.current)
            imageCopyResetRef.current = null
          }
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
        if (noteId && !anchor.classList.contains('note-link-broken')) {
          openNote(noteId)
        }
        return
      }

      if (anchor.classList.contains('note-attachment-link')) {
        e.preventDefault()
        e.stopPropagation()
        const attachmentId = anchor.getAttribute('data-attachment-id')
        if (attachmentId) void window.electronAPI.notesExtras.openAttachment(attachmentId)
        return
      }

      // Task list checkbox write-back
      const checkbox = target.closest('input[type="checkbox"]') as HTMLInputElement | null
      if (checkbox && preview.contains(checkbox) && !isTrashNote) {
        // handled in change listener below
      }

      // External URL: open in default browser
      const href = anchor.getAttribute('href')
      if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
        e.preventDefault()
        e.stopPropagation()
        window.electronAPI.window.openExternal(href)
      }
    }

    const handleChange = (e: Event) => {
      const checkbox = e.target as HTMLInputElement
      if (!checkbox || checkbox.type !== 'checkbox' || isTrashNote || !currentNote) return
      const listItem = checkbox.closest('li')
      if (!listItem) return
      const items = Array.from(preview.querySelectorAll('.task-list-item, li.task-list-item, li'))
        .filter(li => li.querySelector('input[type="checkbox"]'))
      const index = items.indexOf(listItem)
      if (index < 0) return

      let seen = -1
      const next = latestContentRef.current.replace(/^(\s*[-*+]\s+)\[([ xX])\]/gm, (full, prefix, mark) => {
        seen += 1
        if (seen !== index) return full
        return `${prefix}[${checkbox.checked ? 'x' : ' '}]`
      })
      if (next !== latestContentRef.current) {
        latestContentRef.current = next
        setContent(next)
        markNoteDirty(currentNote.id)
      }
    }

    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const img = target.closest('img') as HTMLImageElement | null
      if (!img || !preview.contains(img)) return

      const imageId = img.getAttribute('data-arknote-image-id')
      const src = img.currentSrc || img.src
      const source = imageId || src
      if (!source) return

      e.preventDefault()
      e.stopPropagation()
      setImageContextMenu({ x: e.clientX, y: e.clientY, source })
    }

    preview.addEventListener('click', handleClick)
    preview.addEventListener('change', handleChange)
    preview.addEventListener('contextmenu', handleContextMenu)
    return () => {
      preview.removeEventListener('click', handleClick)
      preview.removeEventListener('change', handleChange)
      preview.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [openNote, showPreview, t, isTrashNote, currentNote, markNoteDirty])

  const flushCurrentNote = useCallback(async () => {
    if (!currentNote || isTrashNote) return

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    const noteId = currentNote.id

    // Join any in-flight save so concurrent flushes serialize.
    while (saveInFlightRef.current) {
      await saveInFlightRef.current
    }

    let savePromise!: Promise<void>
    savePromise = (async () => {
      markSaveStarted(noteId)
      try {
        // Keep writing until latestContentRef is stable across the async update.
        let contentToWrite = latestContentRef.current
        while (true) {
          await window.electronAPI.notes.update(noteId, contentToWrite)
          if (latestContentRef.current === contentToWrite) {
            markSaveSucceeded(noteId)
            return
          }
          contentToWrite = latestContentRef.current
          markSaveStarted(noteId)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : t('保存失败')
        markSaveFailed(noteId, message)
        throw error
      } finally {
        if (saveInFlightRef.current === savePromise) {
          saveInFlightRef.current = null
        }
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
          const message = error instanceof Error ? error.message : t('保存版本失败')
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

  // Sync from store only when switching notes or when store content was replaced
  // externally (refresh/open/version restore). Metadata-only updates (e.g. rename
  // via loadData) must not overwrite the editor with stale open-time content.
  useEffect(() => {
    if (!currentNote) {
      appliedNoteIdRef.current = null
      appliedStoreContentRef.current = null
      return
    }

    const noteChanged = currentNote.id !== appliedNoteIdRef.current
    const storeContentReplaced =
      !noteChanged && currentNote.content !== appliedStoreContentRef.current

    if (noteChanged || storeContentReplaced) {
      const migratedContent = migrateLegacyBrandReferences(currentNote.content)
      const syncedContent = !isTrashNote
        ? setLeadingMarkdownTitle(migratedContent, currentNote.metadata.title, t('无标题'))
        : migratedContent
      setContent(syncedContent)
      latestContentRef.current = syncedContent
      setTitle(getLeadingMarkdownTitle(syncedContent) || currentNote.metadata.title)
      appliedNoteIdRef.current = currentNote.id
      appliedStoreContentRef.current = currentNote.content
      if (!isTrashNote && syncedContent !== currentNote.content) {
        handleContentChange(syncedContent)
      }
      if (noteChanged && previewScrollRef.current) {
        previewScrollRef.current.scrollTop = 0
      }
      return
    }

    // Same note, same store content: title-only metadata update (sidebar rename / loadData)
    if (isTrashNote) {
      setTitle(currentNote.metadata.title)
      return
    }

    const nextContent = setLeadingMarkdownTitle(
      latestContentRef.current,
      currentNote.metadata.title,
      t('无标题'),
    )
    setTitle(getLeadingMarkdownTitle(nextContent) || currentNote.metadata.title)
    if (nextContent !== latestContentRef.current) {
      handleContentChange(nextContent)
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
      const message = error instanceof Error ? error.message : t('保存版本失败')
      markSaveFailed(currentNote.id, message)
    }
  }, [currentNote, flushCurrentNote, isTrashNote, markSaveFailed, markSaveSucceeded])

  // Handle title change (not for trash notes)
  const handleTitleChange = useCallback(async (newTitle: string) => {
    if (isTrashNote) return
    setTitle(newTitle)
    if (currentNote) {
      const nextContent = setLeadingMarkdownTitle(latestContentRef.current, newTitle, t('无标题'))
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
        const message = error instanceof Error ? error.message : t('标题保存失败')
        markSaveFailed(currentNote.id, message)
      }
    }
  }, [clearSaveError, currentNote, flushCurrentNote, isTrashNote, loadData, markNoteDirty, markSaveFailed])

  // Select and persist an image. The toolbar inserts it at the current selection.
  const handleImageUpload = useCallback(async (): Promise<string | null> => {
    if (!currentNote || isTrashNote) return null

    try {
      return await window.electronAPI.images.selectAndSave(currentNote.id)
    } catch (error) {
      console.error('Image upload failed:', error)
      return null
    }
  }, [currentNote, isTrashNote])

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

  if (!currentNote) return null

  const noteActions = (
    <div className="note-actions">
      {!isTrashNote && (
        <button className="icon-btn" onClick={handleManualSave} data-tooltip={t('保存版本 (Ctrl+S)')}>
          <Save size={18} strokeWidth={1.5} />
        </button>
      )}
      {!isTrashNote && (
        <button
          className="icon-btn"
          data-tooltip={pinned ? t('取消置顶') : t('置顶')}
          onClick={() => {
            void (async () => {
              const ids = await window.electronAPI.notesExtras.getPinned()
              const next = pinned ? ids.filter(id => id !== currentNote.id) : [currentNote.id, ...ids]
              await window.electronAPI.notesExtras.setPinned(next)
              setPinned(!pinned)
            })()
          }}
        >
          <Pin size={18} strokeWidth={1.5} style={{ color: pinned ? 'var(--accent)' : undefined }} />
        </button>
      )}
      {!isTrashNote && (
        <button
          className="icon-btn"
          data-tooltip={t('添加附件')}
          onClick={() => {
            void window.electronAPI.notesExtras.addAttachment(currentNote.id).then(async (att) => {
              if (!att) return
              await loadData()
              await openNote(currentNote.id)
            })
          }}
        >
          <Paperclip size={18} strokeWidth={1.5} />
        </button>
      )}
      {showPreview && (
        <button className="icon-btn" data-tooltip={t('大纲')} onClick={() => setShowOutline(v => !v)}>
          <ListTree size={18} strokeWidth={1.5} />
        </button>
      )}

      {!isTrashNote && saveState.noteId === currentNote.id && saveState.phase !== 'idle' && (
        <span className={`note-save-status ${saveState.phase === 'error' ? 'error' : ''}`}>
          {saveState.phase === 'dirty' && t('未保存')}
          {saveState.phase === 'saving' && t('保存中...')}
          {saveState.phase === 'saved' && t('已保存')}
          {saveState.phase === 'error' && t('保存失败：{message}', { message: t(saveState.errorMessage || '请重试') })}
        </span>
      )}

      {!isTrashNote && (
        <div className="mode-toggle">
          <button
            className={isEditing && !livePreview ? 'active' : ''}
            onClick={() => {
              setLivePreview(false)
              setIsEditing(true)
            }}
          >
            <Edit3 size={14} strokeWidth={1.5} style={{ marginRight: 4 }} />
            {t('编辑')}
          </button>
          <button
            className={isEditing && livePreview ? 'active' : ''}
            onClick={() => {
              setLivePreview(true)
              setIsEditing(true)
            }}
          >
            <Columns2 size={14} strokeWidth={1.5} style={{ marginRight: 4 }} />
            {t('分栏')}
          </button>
          <button
            className={!isEditing ? 'active' : ''}
            onClick={() => {
              setIsEditing(false)
              flushCurrentNote().catch(() => {})
            }}
          >
            <Eye size={14} strokeWidth={1.5} style={{ marginRight: 4 }} />
            {t('预览')}
          </button>
        </div>
      )}

      <NoteMenu
        noteId={currentNote.id}
        htmlContent={sanitizedHtml}
        getExportHtml={() => {
          const preview = previewRef.current
          if (!preview) return sanitizedHtml
          const clone = preview.cloneNode(true) as HTMLElement
          clone.querySelectorAll('.md-code-copy').forEach((el) => el.remove())
          clone.querySelectorAll('mark.search-highlight').forEach((mark) => {
            const parent = mark.parentNode
            if (!parent) return
            while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
            parent.removeChild(mark)
          })
          return clone.innerHTML || sanitizedHtml
        }}
        trashMode={isTrashNote}
      />
    </div>
  )

  return (
    <div className="note-view">
      {isTrashNote && (
        <div className="note-toolbar">
          <div className="note-toolbar-left">
            {/* Breadcrumb path */}
            <span className="breadcrumb-item trash-badge">{t('回收站')}</span>
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
              placeholder={t('无标题')}
              readOnly
            />
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

      <NoteTagBar
        noteId={currentNote.id}
        tagIds={currentNote.metadata.tags}
        readOnly={isTrashNote}
      />

      {/* Search in note (floating, top-right) */}
      <SearchInNote onHighlight={handleSearchHighlight} />

      {/* Note body */}
      <div className={`note-body ${!showEditor ? 'preview-note-body' : ''} ${isSplitView ? 'split-note-body' : ''}`}>
        {showEditor && (
          <div className="note-editor-pane" style={{ ['--editor-font-size' as string]: `${editorFontSize}px`, position: 'relative' }}>
            <NoteEditor
              content={content}
              onChange={handleContentChange}
              onSave={handleManualSave}
              onReady={handleEditorReady}
            />
          </div>
        )}
        {showPreview && (
          <div className="note-preview-pane" style={{ display: 'flex', gap: 0 }}>
            <div
              ref={previewScrollRef}
              style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto' }}
            >
              <div
                ref={previewRef}
                className="markdown-preview"
                dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                style={{ fontSize: `${editorFontSize}px` }}
              />
              {backlinks.length > 0 && (
                <div style={{ padding: '16px 24px 28px', borderTop: '0.5px solid var(--border)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{t('反向链接')}</div>
                  {backlinks.map(link => (
                    <button
                      key={link.id}
                      className="btn"
                      style={{ display: 'block', marginBottom: 4, fontSize: 13 }}
                      onClick={() => void openNote(link.id)}
                    >
                      {link.title || t('未命名笔记')}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {showOutline && outline.length > 0 && (
              <aside style={{
                width: 180, flexShrink: 0, borderLeft: '0.5px solid var(--border)',
                padding: '12px 10px', overflow: 'auto', fontSize: 12,
              }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: 8 }}>{t('大纲')}</div>
                {outline.map((item, idx) => (
                  <button
                    key={`${item.line}-${idx}`}
                    className="btn"
                    style={{
                      display: 'block', width: '100%', textAlign: 'left', marginBottom: 2,
                      paddingLeft: 4 + (item.level - 1) * 10, fontSize: 12,
                    }}
                    onClick={() => {
                      const headings = previewRef.current?.querySelectorAll('h1, h2, h3')
                      const el = headings?.[idx] as HTMLElement | undefined
                      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                  >
                    {item.text}
                  </button>
                ))}
              </aside>
            )}
          </div>
        )}
        <BackToTopButton
          scrollRef={previewScrollRef}
          enabled={showPreview}
          resetKey={currentNote.id}
        />
      </div>

      {imagePopupSrc && ReactDOM.createPortal(
        <div className="image-lightbox-overlay" onClick={closeImagePopup}>
          <button
            className={`image-lightbox-copy${imageCopyState === 'copied' ? ' is-success' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              void copyImagePopup()
            }}
            aria-label={
              imageCopyState === 'copied'
                ? t('已复制')
                : imageCopyState === 'failed'
                  ? t('复制失败')
                  : t('复制图片')
            }
            title={
              imageCopyState === 'copied'
                ? t('已复制')
                : imageCopyState === 'failed'
                  ? t('复制失败')
                  : t('复制图片')
            }
            disabled={imageCopyState === 'copied'}
          >
            {imageCopyState === 'copied' ? (
              <Check size={20} strokeWidth={1.8} />
            ) : (
              <Copy size={20} strokeWidth={1.8} />
            )}
          </button>
          <button
            className="image-lightbox-close"
            onClick={(e) => {
              e.stopPropagation()
              closeImagePopup()
            }}
            aria-label={t('关闭原图预览')}
          >
            <X size={22} strokeWidth={1.8} />
          </button>
          <div className="image-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={imagePopupSrc} alt={imagePopupAlt || t('原图预览')} />
          </div>
        </div>,
        document.body
      )}

      {imageContextMenu && (
        <ImageContextMenu
          x={imageContextMenu.x}
          y={imageContextMenu.y}
          onCopy={() => copyArkNoteImageToClipboard(imageContextMenu.source)}
          onClose={() => setImageContextMenu(null)}
        />
      )}
    </div>
  )
}
