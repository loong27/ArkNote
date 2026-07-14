import React, { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { useStore } from '../../store/useStore'

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
}

export interface NoteEditorHandle {
  getEditorView: () => EditorView | null
}

export const NoteEditor = forwardRef<NoteEditorHandle, Props>(({ content, onChange, onSave }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const currentNote = useStore(s => s.currentNote)
  const theme = useStore(s => s.theme)

  // Expose editor view to parent via ref
  useImperativeHandle(ref, () => ({
    getEditorView: () => viewRef.current,
  }), [])

  // Handle image paste
  const handlePaste = useCallback(async (event: ClipboardEvent, view: EditorView) => {
    const items = event.clipboardData?.items
    if (!items) return false

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        event.preventDefault()

        const file = item.getAsFile()
        if (!file || !currentNote) return true

        try {
          // Read file as base64
          const reader = new FileReader()
          reader.onload = async () => {
            const base64 = (reader.result as string).split(',')[1]
            const imageId = await window.electronAPI.images.save(
              currentNote.id,
              base64,
              file.name || 'paste.png'
            )

            // Insert image as HTML <img> with width=600 (matching the insert image button)
            const imageHtml = `\n<img src="zznote://${imageId}" alt="image" width="600" />\n`
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

    return false
  }, [currentNote])

  useEffect(() => {
    if (!containerRef.current) return

    const largeDocument = isLargeDocument(content)

    const state = EditorState.create({
      doc: content,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        ...(!largeDocument ? [highlightSelectionMatches()] : []),
        largeDocument
          ? markdown({ base: markdownLanguage })
          : markdown({ base: markdownLanguage, codeLanguages: languages }),
        theme === 'dark' ? darkTheme : lightTheme,
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
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
              const text = selected || '粗体文本'
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
              const text = selected || '斜体文本'
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
          }
        }),
        EditorView.domEventHandlers({
          paste: (event, view) => {
            handlePaste(event, view)
            return false
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

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [theme, currentNote?.id]) // Recreate editor when switching notes or theme changes

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

  return <div ref={containerRef} className="editor-container" />
})

NoteEditor.displayName = 'NoteEditor'
