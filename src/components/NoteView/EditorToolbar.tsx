import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Bold, Italic, Underline, Strikethrough, Minus, Highlighter,
  Palette, List, ListOrdered, ListChecks, Link2, ImagePlus,
  Code, Table, GitBranch, PieChart, Workflow, Smile,
  FileText,
} from 'lucide-react'
import { EditorView } from '@codemirror/view'
import { useStore } from '../../store/useStore'

interface Props {
  editorViewRef: React.RefObject<EditorView | null>
  onImageUpload: () => void
  rightActions?: React.ReactNode
}

// Common emoji list for quick insertion
const EMOJI_LIST = [
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉',
  '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😋', '😛',
  '🤔', '🤗', '🤭', '😐', '😑', '😶', '😏', '😒', '🙄', '😬',
  '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥',
  '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱',
  '😤', '😡', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹',
  '👍', '👎', '👏', '🙌', '🤝', '🙏', '✍️', '💪', '🦾', '🧠',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '❣️',
  '⭐', '🌟', '✨', '⚡', '🔥', '💯', '✅', '❌', '⚠️', '🚀',
  '📌', '📎', '📝', '📚', '📖', '💡', '🔑', '🔒', '🔔', '🎯',
]

// Preset colors for font color picker
const COLOR_PRESETS = [
  '#f38ba8', '#fab387', '#f9e2af', '#a6e3a1', '#94e2d5',
  '#89dceb', '#89b4fa', '#b4befe', '#cba6f7', '#f5c2e7',
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
  '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0d9488',
  '#0891b2', '#2563eb', '#4f46e5', '#7c3aed', '#db2777',
  '#ffffff', '#d4d4d8', '#a1a1aa', '#71717a', '#52525b',
  '#3f3f46', '#27272a', '#18181b', '#000000', '#1e1e2e',
]

// Table size grid max
const TABLE_MAX_ROWS = 8
const TABLE_MAX_COLS = 8

export const EditorToolbar: React.FC<Props> = ({ editorViewRef, onImageUpload, rightActions }) => {
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showTablePicker, setShowTablePicker] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showNoteLinkPicker, setShowNoteLinkPicker] = useState(false)
  const [tableHover, setTableHover] = useState({ rows: 0, cols: 0 })
  const [noteLinkSearch, setNoteLinkSearch] = useState('')

  const colorPickerRef = useRef<HTMLDivElement>(null)
  const tablePickerRef = useRef<HTMLDivElement>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const noteLinkRef = useRef<HTMLDivElement>(null)

  const { notes, noteById, getDirectoryPathString } = useStore()

  // Close all dropdowns when clicking outside — use click event, not mousedown,
  // to avoid race conditions where the dropdown closes before button click registers
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false)
      }
      if (tablePickerRef.current && !tablePickerRef.current.contains(e.target as Node)) {
        setShowTablePicker(false)
      }
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false)
      }
      if (noteLinkRef.current && !noteLinkRef.current.contains(e.target as Node)) {
        setShowNoteLinkPicker(false)
      }
    }
    // Use 'click' instead of 'mousedown' so the button onClick fires first
    document.addEventListener('click', handleClickOutside, true)
    return () => document.removeEventListener('click', handleClickOutside, true)
  }, [])

  // Helper: get selected text from editor
  const getSelection = useCallback((): { from: number; to: number; text: string } | null => {
    const view = editorViewRef.current
    if (!view) return null
    const { from, to } = view.state.selection.main
    const text = view.state.sliceDoc(from, to)
    return { from, to, text }
  }, [editorViewRef])

  // Helper: wrap selected text or insert at cursor
  const wrapSelection = useCallback((prefix: string, suffix: string, placeholder?: string) => {
    const view = editorViewRef.current
    if (!view) return
    const sel = getSelection()
    if (!sel) return

    const { from, to, text } = sel
    const insertText = text || placeholder || ''
    const newText = `${prefix}${insertText}${suffix}`

    view.dispatch({
      changes: { from, to, insert: newText },
      selection: {
        anchor: from + prefix.length,
        head: from + prefix.length + insertText.length,
      },
    })
    view.focus()
  }, [editorViewRef, getSelection])

  // Helper: insert text at cursor position
  const insertAtCursor = useCallback((text: string) => {
    const view = editorViewRef.current
    if (!view) return
    const pos = view.state.selection.main.head
    view.dispatch({
      changes: { from: pos, insert: text },
      selection: { anchor: pos + text.length },
    })
    view.focus()
  }, [editorViewRef])

  // Helper: insert text at beginning of current line(s)
  const insertAtLineStart = useCallback((prefix: string) => {
    const view = editorViewRef.current
    if (!view) return
    const { from, to } = view.state.selection.main
    const fromLine = view.state.doc.lineAt(from)
    const toLine = view.state.doc.lineAt(to)

    const changes: Array<{ from: number; to: number; insert: string }> = []
    for (let i = fromLine.number; i <= toLine.number; i++) {
      const line = view.state.doc.line(i)
      changes.push({ from: line.from, to: line.from, insert: prefix })
    }
    view.dispatch({ changes })
    view.focus()
  }, [editorViewRef])

  // ===== Toolbar Action Handlers =====

  const handleBold = () => wrapSelection('**', '**', '粗体文本')
  const handleItalic = () => wrapSelection('*', '*', '斜体文本')
  const handleUnderline = () => wrapSelection('<u>', '</u>', '下划线文本')
  const handleStrikethrough = () => wrapSelection('~~', '~~', '删除线文本')
  const handleHorizontalRule = () => insertAtCursor('\n\n---\n\n')
  const handleHighlight = () => wrapSelection('<mark>', '</mark>', '高亮文本')
  const handleInlineCode = () => wrapSelection('`', '`', 'code')

  const handleFontColor = (color: string) => {
    const sel = getSelection()
    const text = sel?.text || '彩色文本'
    wrapSelection(`<span style="color: ${color}">`, '</span>', text)
    setShowColorPicker(false)
  }

  const handleUnorderedList = () => insertAtLineStart('- ')
  const handleOrderedList = () => {
    const view = editorViewRef.current
    if (!view) return
    const { from, to } = view.state.selection.main
    const fromLine = view.state.doc.lineAt(from)
    const toLine = view.state.doc.lineAt(to)

    const changes: Array<{ from: number; to: number; insert: string }> = []
    let num = 1
    for (let i = fromLine.number; i <= toLine.number; i++) {
      const line = view.state.doc.line(i)
      changes.push({ from: line.from, to: line.from, insert: `${num}. ` })
      num++
    }
    view.dispatch({ changes })
    view.focus()
  }

  const handleTaskList = () => insertAtLineStart('- [ ] ')

  const handleLink = () => {
    const sel = getSelection()
    if (sel && sel.text) {
      wrapSelection('[', '](url)', sel.text)
    } else {
      insertAtCursor('[链接文本](url)')
    }
  }

  const handleImageInsert = () => {
    // Insert HTML img tag with editable width for resizing
    onImageUpload()
  }

  const handleTable = (rows: number, cols: number) => {
    setShowTablePicker(false)
    let table = '\n'
    // Header
    table += '| ' + Array.from({ length: cols }, (_, i) => `列${i + 1}`).join(' | ') + ' |\n'
    // Separator
    table += '| ' + Array.from({ length: cols }, () => '---').join(' | ') + ' |\n'
    // Rows
    for (let r = 0; r < rows - 1; r++) {
      table += '| ' + Array.from({ length: cols }, () => '   ').join(' | ') + ' |\n'
    }
    table += '\n'
    insertAtCursor(table)
  }

  const handleSequenceDiagram = () => {
    insertAtCursor('\n```mermaid\nsequenceDiagram\n    participant A as 参与者A\n    participant B as 参与者B\n    A->>B: 请求\n    B-->>A: 响应\n```\n')
  }

  const handleFlowchart = () => {
    insertAtCursor('\n```mermaid\nflowchart TD\n    A[开始] --> B{判断}\n    B -->|是| C[处理]\n    B -->|否| D[结束]\n    C --> D\n```\n')
  }

  const handlePieChart = () => {
    insertAtCursor('\n```mermaid\npie title 饼图示例\n    "类别A" : 40\n    "类别B" : 30\n    "类别C" : 20\n    "类别D" : 10\n```\n')
  }

  const handleEmoji = (emoji: string) => {
    insertAtCursor(emoji)
    setShowEmojiPicker(false)
  }

  // Get directory path for a note
  const getNotePath = useCallback((noteId: string): string => {
    const note = noteById.get(noteId)
    if (!note) return ''
    return getDirectoryPathString(note.directoryId)
  }, [noteById, getDirectoryPathString])

  const handleNoteLink = (noteId: string, noteTitle: string) => {
    // Insert as a markdown link with special protocol
    insertAtCursor(`[${noteTitle}](zznote-link://${noteId})`)
    setShowNoteLinkPicker(false)
    setNoteLinkSearch('')
  }

  // Filter notes for the link picker
  const filteredNotes = noteLinkSearch.trim()
    ? notes.filter(n => n.title.toLowerCase().includes(noteLinkSearch.toLowerCase()))
    : notes

  return (
    <div className="editor-toolbar">
      <div className="editor-toolbar-main">
      {/* Text Formatting */}
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={handleBold} title="加粗 (Ctrl+B)">
          <Bold size={16} strokeWidth={1.5} />
        </button>
        <button className="toolbar-btn" onClick={handleItalic} title="斜体 (Ctrl+I)">
          <Italic size={16} strokeWidth={1.5} />
        </button>
        <button className="toolbar-btn" onClick={handleUnderline} title="下划线">
          <Underline size={16} strokeWidth={1.5} />
        </button>
        <button className="toolbar-btn" onClick={handleStrikethrough} title="删除线">
          <Strikethrough size={16} strokeWidth={1.5} />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Highlight & Color */}
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={handleHighlight} title="文本高亮">
          <Highlighter size={16} strokeWidth={1.5} />
        </button>
        <div className="toolbar-dropdown-container" ref={colorPickerRef}>
          <button
            className="toolbar-btn"
            onClick={(e) => {
              e.stopPropagation()
              setShowColorPicker(!showColorPicker)
              setShowTablePicker(false)
              setShowEmojiPicker(false)
              setShowNoteLinkPicker(false)
            }}
            title="字体颜色"
          >
            <Palette size={16} strokeWidth={1.5} />
          </button>
          {showColorPicker && (
            <div className="toolbar-dropdown color-picker-dropdown" onClick={(e) => e.stopPropagation()}>
              <div className="color-grid">
                {COLOR_PRESETS.map(color => (
                  <button
                    key={color}
                    className="color-swatch"
                    style={{ backgroundColor: color }}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleFontColor(color)
                    }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="toolbar-divider" />

      {/* Horizontal Rule & Code */}
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={handleHorizontalRule} title="水平线">
          <Minus size={16} strokeWidth={1.5} />
        </button>
        <button className="toolbar-btn" onClick={handleInlineCode} title="内嵌代码">
          <Code size={16} strokeWidth={1.5} />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Lists */}
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={handleUnorderedList} title="无序列表">
          <List size={16} strokeWidth={1.5} />
        </button>
        <button className="toolbar-btn" onClick={handleOrderedList} title="有序列表">
          <ListOrdered size={16} strokeWidth={1.5} />
        </button>
        <button className="toolbar-btn" onClick={handleTaskList} title="任务列表">
          <ListChecks size={16} strokeWidth={1.5} />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Insert */}
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={handleLink} title="插入链接">
          <Link2 size={16} strokeWidth={1.5} />
        </button>
        <button className="toolbar-btn" onClick={handleImageInsert} title="插入图片">
          <ImagePlus size={16} strokeWidth={1.5} />
        </button>

        {/* Table Picker */}
        <div className="toolbar-dropdown-container" ref={tablePickerRef}>
          <button
            className="toolbar-btn"
            onClick={(e) => {
              e.stopPropagation()
              setShowTablePicker(!showTablePicker)
              setShowColorPicker(false)
              setShowEmojiPicker(false)
              setShowNoteLinkPicker(false)
            }}
            title="插入表格"
          >
            <Table size={16} strokeWidth={1.5} />
          </button>
          {showTablePicker && (
            <div className="toolbar-dropdown table-picker-dropdown" onClick={(e) => e.stopPropagation()}>
              <div className="table-picker-label">
                {tableHover.rows > 0 ? `${tableHover.rows} × ${tableHover.cols}` : '选择表格大小'}
              </div>
              <div className="table-grid">
                {Array.from({ length: TABLE_MAX_ROWS }, (_, row) => (
                  <div key={row} className="table-grid-row">
                    {Array.from({ length: TABLE_MAX_COLS }, (_, col) => (
                      <div
                        key={col}
                        className={`table-grid-cell ${
                          row < tableHover.rows && col < tableHover.cols ? 'active' : ''
                        }`}
                        onMouseEnter={() => setTableHover({ rows: row + 1, cols: col + 1 })}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleTable(row + 1, col + 1)
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="toolbar-divider" />

      {/* Diagrams */}
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={handleSequenceDiagram} title="时序图">
          <GitBranch size={16} strokeWidth={1.5} />
        </button>
        <button className="toolbar-btn" onClick={handleFlowchart} title="流程图">
          <Workflow size={16} strokeWidth={1.5} />
        </button>
        <button className="toolbar-btn" onClick={handlePieChart} title="饼图">
          <PieChart size={16} strokeWidth={1.5} />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Emoji */}
      <div className="toolbar-group">
        <div className="toolbar-dropdown-container" ref={emojiPickerRef}>
          <button
            className="toolbar-btn"
            onClick={(e) => {
              e.stopPropagation()
              setShowEmojiPicker(!showEmojiPicker)
              setShowColorPicker(false)
              setShowTablePicker(false)
              setShowNoteLinkPicker(false)
            }}
            title="插入表情"
          >
            <Smile size={16} strokeWidth={1.5} />
          </button>
          {showEmojiPicker && (
            <div className="toolbar-dropdown emoji-picker-dropdown" onClick={(e) => e.stopPropagation()}>
              <div className="emoji-grid">
                {EMOJI_LIST.map((emoji, idx) => (
                  <button
                    key={idx}
                    className="emoji-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEmoji(emoji)
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Note Link */}
        <div className="toolbar-dropdown-container" ref={noteLinkRef}>
          <button
            className="toolbar-btn"
            onClick={(e) => {
              e.stopPropagation()
              setShowNoteLinkPicker(!showNoteLinkPicker)
              setShowColorPicker(false)
              setShowTablePicker(false)
              setShowEmojiPicker(false)
              setNoteLinkSearch('')
            }}
            title="插入笔记链接"
          >
            <FileText size={16} strokeWidth={1.5} />
          </button>
          {showNoteLinkPicker && (
            <div className="toolbar-dropdown note-link-dropdown" onClick={(e) => e.stopPropagation()}>
              <input
                className="note-link-search"
                type="text"
                placeholder="搜索笔记..."
                value={noteLinkSearch}
                onChange={(e) => setNoteLinkSearch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
              <div className="note-link-list">
                {filteredNotes.length === 0 ? (
                  <div className="note-link-empty">未找到笔记</div>
                ) : (
                  filteredNotes.slice(0, 20).map(note => (
                    <button
                      key={note.id}
                      className="note-link-item"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleNoteLink(note.id, note.title)
                      }}
                    >
                      <span className="note-link-title">{note.title}</span>
                      <span className="note-link-path">{getNotePath(note.id)}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
      {rightActions && <div className="editor-toolbar-actions">{rightActions}</div>}
    </div>
  )
}
