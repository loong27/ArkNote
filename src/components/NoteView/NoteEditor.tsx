import React, { useEffect, useRef, useCallback, useState } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { search, searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { useStore } from '../../store/useStore'
import { useI18n } from '../../i18n/I18nProvider'
import { findArkNoteImageAt, hasArkNoteImages } from '../../../shared/inlineArkNoteImages'
import { copyArkNoteImageToClipboard } from '../../utils/copyImage'
import { writeClipboardText } from '../../utils/clipboard'
import { htmlToMarkdown } from '../../utils/htmlToMarkdown'
import { getPasteConvertCandidate } from '../../utils/pasteDetect'
import { createEditorSearchPanel, editorSearchPhrases, openReplacePanel } from './editorSearchPanel'
import { ImageContextMenu } from './ImageContextMenu'
import { PasteConvertNotice } from './PasteConvertNotice'

interface PasteConvertOffer {
  from: number
  to: number
  plain: string
  html: string
}

const darkHighlightStyle = HighlightStyle.define([
  { tag: t.heading, color: '#89b4fa', fontWeight: '600' },
  { tag: t.strong, fontWeight: '700' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.link, color: '#89b4fa' },
  { tag: t.url, color: '#89dceb' },
  { tag: t.processingInstruction, color: '#6c7086' },
  { tag: t.monospace, color: '#f9e2af' },
  { tag: t.comment, color: '#6c7086', fontStyle: 'italic' },
  { tag: t.lineComment, color: '#6c7086', fontStyle: 'italic' },
  { tag: t.blockComment, color: '#6c7086', fontStyle: 'italic' },
  { tag: t.keyword, color: '#cba6f7' },
  { tag: t.controlKeyword, color: '#cba6f7' },
  { tag: t.operatorKeyword, color: '#cba6f7' },
  { tag: t.definitionKeyword, color: '#cba6f7' },
  { tag: t.moduleKeyword, color: '#cba6f7' },
  { tag: t.string, color: '#a6e3a1' },
  { tag: t.special(t.string), color: '#a6e3a1' },
  { tag: t.number, color: '#fab387' },
  { tag: t.bool, color: '#fab387' },
  { tag: t.null, color: '#fab387' },
  { tag: t.regexp, color: '#f5c2e7' },
  { tag: t.variableName, color: '#cdd6f4' },
  { tag: t.definition(t.variableName), color: '#89b4fa' },
  { tag: t.function(t.variableName), color: '#89b4fa' },
  { tag: t.propertyName, color: '#89b4fa' },
  { tag: t.typeName, color: '#f9e2af' },
  { tag: t.className, color: '#f9e2af' },
  { tag: t.namespace, color: '#f9e2af' },
  { tag: t.attributeName, color: '#f9e2af' },
  { tag: t.tagName, color: '#89b4fa' },
  { tag: t.angleBracket, color: '#7f849c' },
  { tag: t.operator, color: '#89dceb' },
  { tag: t.punctuation, color: '#a6adc8' },
  { tag: t.bracket, color: '#a6adc8' },
  { tag: t.meta, color: '#6c7086' },
  { tag: t.invalid, color: '#f38ba8' },
])

const lightHighlightStyle = HighlightStyle.define([
  { tag: t.heading, color: '#2563eb', fontWeight: '600' },
  { tag: t.strong, fontWeight: '700' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.link, color: '#2563eb' },
  { tag: t.url, color: '#0891b2' },
  { tag: t.processingInstruction, color: '#94a3b8' },
  { tag: t.monospace, color: '#b45309' },
  { tag: t.comment, color: '#94a3b8', fontStyle: 'italic' },
  { tag: t.lineComment, color: '#94a3b8', fontStyle: 'italic' },
  { tag: t.blockComment, color: '#94a3b8', fontStyle: 'italic' },
  { tag: t.keyword, color: '#7c3aed' },
  { tag: t.controlKeyword, color: '#7c3aed' },
  { tag: t.operatorKeyword, color: '#7c3aed' },
  { tag: t.definitionKeyword, color: '#7c3aed' },
  { tag: t.moduleKeyword, color: '#7c3aed' },
  { tag: t.string, color: '#16a34a' },
  { tag: t.special(t.string), color: '#16a34a' },
  { tag: t.number, color: '#ea580c' },
  { tag: t.bool, color: '#ea580c' },
  { tag: t.null, color: '#ea580c' },
  { tag: t.regexp, color: '#db2777' },
  { tag: t.variableName, color: '#1e293b' },
  { tag: t.definition(t.variableName), color: '#2563eb' },
  { tag: t.function(t.variableName), color: '#2563eb' },
  { tag: t.propertyName, color: '#2563eb' },
  { tag: t.typeName, color: '#ca8a04' },
  { tag: t.className, color: '#ca8a04' },
  { tag: t.namespace, color: '#ca8a04' },
  { tag: t.attributeName, color: '#ca8a04' },
  { tag: t.tagName, color: '#2563eb' },
  { tag: t.angleBracket, color: '#94a3b8' },
  { tag: t.operator, color: '#0891b2' },
  { tag: t.punctuation, color: '#64748b' },
  { tag: t.bracket, color: '#64748b' },
  { tag: t.meta, color: '#94a3b8' },
  { tag: t.invalid, color: '#dc2626' },
])

const darkTheme = EditorView.theme({
  '&': { backgroundColor: '#252932', color: '#f4f7fb' },
  '.cm-content': { caretColor: '#66ccff' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#66ccff' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'rgba(102, 204, 255, 0.24)',
  },
  '.cm-activeLine': { backgroundColor: 'rgba(102, 204, 255, 0.08)' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(102, 204, 255, 0.08)' },
  '.cm-gutters': { backgroundColor: '#252932', color: '#8f9aac', border: 'none' },
  '.cm-lineNumbers .cm-gutterElement': { color: '#8f9aac' },
}, { dark: true })

const lightTheme = EditorView.theme({
  '&': { backgroundColor: '#ffffff', color: '#1e1e2e' },
  '.cm-content': { caretColor: '#2563eb' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#2563eb' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: '#2563eb22',
  },
  '.cm-activeLine': { backgroundColor: '#f5f5ff' },
  '.cm-activeLineGutter': { backgroundColor: '#f5f5ff' },
  '.cm-gutters': { backgroundColor: '#f5f5f5', color: '#8888a0', border: 'none' },
  '.cm-lineNumbers .cm-gutterElement': { color: '#8888a0' },
}, { dark: false })

const LARGE_DOCUMENT_CHAR_LIMIT = 50000
const LARGE_DOCUMENT_LINE_LIMIT = 1200

function isLargeDocument(content: string): boolean {
  if (content.length >= LARGE_DOCUMENT_CHAR_LIMIT) return true
  let lines = 1
  for (let i = 0; i < content.length; i++) {
    if (content.charCodeAt(i) === 10) {
      lines++
      if (lines >= LARGE_DOCUMENT_LINE_LIMIT) return true
    }
  }
  return false
}

interface Props {
  content: string
  onChange: (content: string) => void
  onSave: () => void
  onReady?: (view: EditorView | null) => void
}

export const NoteEditor: React.FC<Props> = ({ content, onChange, onSave, onReady }) => {
  const { t, language } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const currentNote = useStore(s => s.currentNote)
  const theme = useStore(s => s.theme)
  const [imageContextMenu, setImageContextMenu] = useState<{
    x: number
    y: number
    imageId: string
  } | null>(null)
  const openImageContextMenuRef = useRef(setImageContextMenu)
  openImageContextMenuRef.current = setImageContextMenu

  const [pasteConvertOffer, setPasteConvertOffer] = useState<PasteConvertOffer | null>(null)
  const pasteConvertOfferRef = useRef<PasteConvertOffer | null>(null)
  pasteConvertOfferRef.current = pasteConvertOffer

  const dismissPasteConvertOffer = useCallback(() => {
    pasteConvertOfferRef.current = null
    setPasteConvertOffer(null)
  }, [])

  const handleConvertPaste = useCallback(() => {
    const offer = pasteConvertOfferRef.current
    const view = viewRef.current
    if (!offer || !view) {
      dismissPasteConvertOffer()
      return
    }

    const { from, to, plain, html } = offer
    const docLen = view.state.doc.length
    if (from < 0 || to < from || to > docLen || view.state.sliceDoc(from, to) !== plain) {
      dismissPasteConvertOffer()
      return
    }

    const md = htmlToMarkdown(html)
    if (!md) {
      dismissPasteConvertOffer()
      return
    }

    view.dispatch({
      changes: { from, to, insert: md },
      selection: { anchor: from + md.length },
      userEvent: 'input',
    })
    dismissPasteConvertOffer()
  }, [dismissPasteConvertOffer])

  // Handle image paste + rich HTML → Markdown offer
  const handlePaste = useCallback((event: ClipboardEvent, view: EditorView): boolean => {
    const items = event.clipboardData?.items
    if (items) {
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          event.preventDefault()
          dismissPasteConvertOffer()

          const file = item.getAsFile()
          if (!file || !currentNote) return true

          try {
            const reader = new FileReader()
            reader.onload = async () => {
              const base64 = (reader.result as string).split(',')[1]
              const imageId = await window.electronAPI.images.save(
                currentNote.id,
                base64,
                file.name || 'paste.png'
              )

              const imageHtml = `\n<img src="arknote://${imageId}" alt="image" width="600" />\n`
              const pos = view.state.selection.main.head
              view.dispatch({
                changes: { from: pos, insert: imageHtml },
              })
            }
            reader.readAsDataURL(file)
          } catch (error) {
            console.error('Failed to paste image:', error)
          }

          return true
        }
      }
    }

    const candidate = getPasteConvertCandidate(event.clipboardData)
    if (!candidate) return false

    event.preventDefault()
    const { from, to } = view.state.selection.main
    const insert = candidate.plain
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + insert.length },
      userEvent: 'input.paste',
    })

    const offer: PasteConvertOffer = {
      from,
      to: from + insert.length,
      plain: insert,
      html: candidate.html,
    }
    pasteConvertOfferRef.current = offer
    setPasteConvertOffer(offer)
    return true
  }, [currentNote, dismissPasteConvertOffer])

  const handlePasteRef = useRef(handlePaste)
  handlePasteRef.current = handlePaste

  // Copy/cut: convert arknote:// images in selection to external data URLs
  const handleCopyOrCut = useCallback((event: ClipboardEvent, view: EditorView, isCut: boolean) => {
    const { from, to } = view.state.selection.main
    if (from === to) return false

    const selected = view.state.sliceDoc(from, to)
    if (!hasArkNoteImages(selected)) return false

    event.preventDefault()

    void (async () => {
      try {
        const inlined = await window.electronAPI.images.inlineInMarkdown(selected)
        const ok = await writeClipboardText(inlined)
        if (!ok) return

        if (isCut && viewRef.current === view) {
          const docLen = view.state.doc.length
          if (from <= docLen && to <= docLen) {
            view.dispatch({
              changes: { from, to, insert: '' },
              selection: { anchor: from },
              userEvent: 'delete.cut',
            })
          }
        }
      } catch (error) {
        console.error(`Failed to ${isCut ? 'cut' : 'copy'} with inlined images:`, error)
      }
    })()

    return true
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    const largeDocument = isLargeDocument(content)

    const state = EditorState.create({
      doc: content,
      extensions: [
        EditorView.lineWrapping,
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        ...(!largeDocument ? [highlightSelectionMatches()] : []),
        search({ createPanel: createEditorSearchPanel, top: false }),
        EditorState.phrases.of(editorSearchPhrases(t)),
        largeDocument
          ? markdown({ base: markdownLanguage })
          : markdown({ base: markdownLanguage, codeLanguages: languages }),
        syntaxHighlighting(theme === 'dark' ? darkHighlightStyle : lightHighlightStyle),
        theme === 'dark' ? darkTheme : lightTheme,
        keymap.of([
          indentWithTab,
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          { key: 'Mod-h', run: openReplacePanel, scope: 'editor search-panel' },
          {
            key: 'Mod-s',
            run: () => {
              onSave()
              return true
            },
          },
          // Bold
          {
            key: 'Mod-b',
            run: (view) => {
              const { from, to } = view.state.selection.main
              const selected = view.state.sliceDoc(from, to)
              const text = selected || t('粗体文本')
              view.dispatch({
                changes: { from, to, insert: `**${text}**` },
                selection: { anchor: from + 2, head: from + 2 + text.length },
              })
              return true
            },
          },
          // Italic
          {
            key: 'Mod-i',
            run: (view) => {
              const { from, to } = view.state.selection.main
              const selected = view.state.sliceDoc(from, to)
              const text = selected || t('斜体文本')
              view.dispatch({
                changes: { from, to, insert: `*${text}*` },
                selection: { anchor: from + 1, head: from + 1 + text.length },
              })
              return true
            },
          },
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString())
            const offer = pasteConvertOfferRef.current
            if (offer) {
              const doc = update.state.doc
              if (
                offer.from > doc.length
                || offer.to > doc.length
                || doc.sliceString(offer.from, offer.to) !== offer.plain
              ) {
                pasteConvertOfferRef.current = null
                setPasteConvertOffer(null)
              }
            }
          }
        }),
        EditorView.domEventHandlers({
          paste: (event, view) => handlePasteRef.current(event, view),
          copy: (event, view) => handleCopyOrCut(event, view, false),
          cut: (event, view) => handleCopyOrCut(event, view, true),
          contextmenu: (event, view) => {
            const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
            if (pos == null) return false

            const line = view.state.doc.lineAt(pos)
            const imageId = findArkNoteImageAt(line.text, pos - line.from)
            if (!imageId) return false

            event.preventDefault()
            openImageContextMenuRef.current({
              x: event.clientX,
              y: event.clientY,
              imageId,
            })
            return true
          },
        }),
        EditorView.theme({
          '&': {
            height: '100%',
            backgroundColor: 'var(--bg-primary)',
          },
          '.cm-scroller': {
            fontFamily: 'var(--font-mono)',
            fontSize: '16px',
            lineHeight: '1.75',
          },
          '.cm-content': {
            padding: '16px 48px',
          },
          '.cm-gutters': {
            backgroundColor: 'var(--bg-primary)',
            border: 'none',
          },
        }),
      ],
    })

    const view = new EditorView({
      state,
      parent: containerRef.current,
    })

    viewRef.current = view
    onReady?.(view)

    return () => {
      onReady?.(null)
      view.destroy()
      viewRef.current = null
    }
  }, [theme, currentNote?.id, language]) // Recreate editor when switching notes, theme, or language

  // Update content when it changes externally
  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    const currentContent = view.state.doc.toString()
    if (currentContent !== content) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentContent.length,
          insert: content,
        },
      })
    }
  }, [content])

  return (
    <>
      <div ref={containerRef} className="editor-container" />
      {pasteConvertOffer && (
        <PasteConvertNotice
          onConvert={handleConvertPaste}
          onDismiss={dismissPasteConvertOffer}
        />
      )}
      {imageContextMenu && (
        <ImageContextMenu
          x={imageContextMenu.x}
          y={imageContextMenu.y}
          onCopy={() => copyArkNoteImageToClipboard(imageContextMenu.imageId)}
          onClose={() => setImageContextMenu(null)}
        />
      )}
    </>
  )
}
