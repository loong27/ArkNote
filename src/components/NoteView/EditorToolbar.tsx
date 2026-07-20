import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import ReactDOM from 'react-dom'
import {
  Bold,
  Braces,
  Code,
  CodeXml,
  FileText,
  GitBranch,
  Heading1,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  ListTree,
  Minus,
  Palette,
  PieChart,
  Pilcrow,
  Quote,
  Smile,
  Strikethrough,
  Subscript,
  Superscript,
  Table,
  Underline,
  Workflow,
} from 'lucide-react'
import { EditorView } from '@codemirror/view'
import { useStore } from '../../store/useStore'
import { useI18n } from '../../i18n/I18nProvider'

interface Props {
  editorViewRef: React.RefObject<EditorView | null>
  onImageUpload: () => Promise<string | null>
  rightActions?: React.ReactNode
}

type DropdownName = 'heading' | 'color' | 'table' | 'emoji' | 'note-link' | null

interface ToolbarPopoverProps {
  anchorRef: React.RefObject<HTMLButtonElement | null>
  className?: string
  children: React.ReactNode
}

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

const TABLE_MAX_ROWS = 8
const TABLE_MAX_COLS = 8

function ToolbarPopover({ anchorRef, className = '', children }: ToolbarPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0, ready: false })

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current
    const popover = popoverRef.current
    if (!anchor || !popover) return

    const anchorRect = anchor.getBoundingClientRect()
    const width = popover.offsetWidth
    const height = popover.offsetHeight
    const viewportPadding = 8
    let left = anchorRect.left + anchorRect.width / 2 - width / 2
    let top = anchorRect.bottom + 6

    left = Math.max(viewportPadding, Math.min(left, window.innerWidth - width - viewportPadding))
    if (top + height > window.innerHeight - viewportPadding && anchorRect.top > height + 6) {
      top = anchorRect.top - height - 6
    }

    setPosition({ top, left, ready: true })
  }, [anchorRef])

  useLayoutEffect(() => {
    updatePosition()
    const frame = requestAnimationFrame(updatePosition)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [updatePosition])

  return ReactDOM.createPortal(
    <div
      ref={popoverRef}
      className={`toolbar-dropdown toolbar-popover ${className}`}
      style={{
        top: position.top,
        left: position.left,
        visibility: position.ready ? 'visible' : 'hidden',
      }}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  )
}

interface CommandButtonProps {
  title: string
  onClick: () => void
  children: React.ReactNode
}

function CommandButton({ title, onClick, children }: CommandButtonProps) {
  return (
    <button
      type="button"
      className="toolbar-btn"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  )
}

export const EditorToolbar: React.FC<Props> = ({ editorViewRef, onImageUpload, rightActions }) => {
  const { t } = useI18n()
  const [activeDropdown, setActiveDropdown] = useState<DropdownName>(null)
  const [tableHover, setTableHover] = useState({ rows: 0, cols: 0 })
  const [noteLinkSearch, setNoteLinkSearch] = useState('')

  const headingButtonRef = useRef<HTMLButtonElement>(null)
  const colorButtonRef = useRef<HTMLButtonElement>(null)
  const tableButtonRef = useRef<HTMLButtonElement>(null)
  const emojiButtonRef = useRef<HTMLButtonElement>(null)
  const noteLinkButtonRef = useRef<HTMLButtonElement>(null)

  const { notes, noteById, getDirectoryPathString } = useStore()

  useEffect(() => {
    const closeDropdown = () => setActiveDropdown(null)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDropdown()
    }
    document.addEventListener('click', closeDropdown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('click', closeDropdown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const toggleDropdown = useCallback((name: Exclude<DropdownName, null>) => {
    setActiveDropdown((current) => current === name ? null : name)
  }, [])

  const getEditorView = useCallback(() => editorViewRef.current, [editorViewRef])

  const getSelection = useCallback(() => {
    const view = getEditorView()
    if (!view) return null
    const { from, to } = view.state.selection.main
    return { view, from, to, text: view.state.sliceDoc(from, to) }
  }, [getEditorView])

  const replaceSelection = useCallback((text: string, selectionStart = text.length, selectionEnd = selectionStart) => {
    const selection = getSelection()
    if (!selection) return
    const { view, from, to } = selection
    view.dispatch({
      changes: { from, to, insert: text },
      selection: {
        anchor: from + selectionStart,
        head: from + selectionEnd,
      },
      scrollIntoView: true,
    })
    view.focus()
  }, [getSelection])

  const wrapSelection = useCallback((prefix: string, suffix: string, placeholder: string) => {
    const selection = getSelection()
    if (!selection) return
    const text = selection.text || placeholder
    replaceSelection(`${prefix}${text}${suffix}`, prefix.length, prefix.length + text.length)
  }, [getSelection, replaceSelection])

  const transformSelectedLines = useCallback((transform: (lines: string[]) => string[]) => {
    const selection = getSelection()
    if (!selection) return
    const { view, from, to } = selection
    const fromLine = view.state.doc.lineAt(from)
    const adjustedTo = to > from && view.state.doc.lineAt(to).from === to ? to - 1 : to
    const toLine = view.state.doc.lineAt(Math.max(from, adjustedTo))
    const lines = view.state.sliceDoc(fromLine.from, toLine.to).split('\n')
    const nextText = transform(lines).join('\n')

    view.dispatch({
      changes: { from: fromLine.from, to: toLine.to, insert: nextText },
      selection: { anchor: fromLine.from, head: fromLine.from + nextText.length },
      scrollIntoView: true,
    })
    view.focus()
  }, [getSelection])

  const toggleLinePrefix = useCallback((matcher: RegExp, prefix: (index: number) => string, placeholder: string) => {
    transformSelectedLines((lines) => {
      const enabled = lines.every((line) => matcher.test(line))
      return lines.map((line, index) => {
        if (enabled) return line.replace(matcher, '')
        const cleanLine = line.replace(/^\s*(?:[-+*]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+|>\s?)/, '')
        return `${prefix(index)}${cleanLine || placeholder}`
      })
    })
  }, [transformSelectedLines])

  const handleHeading = (level: number) => {
    transformSelectedLines((lines) => lines.map((line) => {
      const text = line.replace(/^\s{0,3}#{1,6}\s+/, '') || t('标题')
      return level === 0 ? text : `${'#'.repeat(level)} ${text}`
    }))
    setActiveDropdown(null)
  }

  const handleBold = () => wrapSelection('**', '**', t('粗体文本'))
  const handleItalic = () => wrapSelection('*', '*', t('斜体文本'))
  const handleUnderline = () => wrapSelection('++', '++', t('插入文本'))
  const handleStrikethrough = () => wrapSelection('~~', '~~', t('删除线文本'))
  const handleHighlight = () => wrapSelection('==', '==', t('高亮文本'))
  const handleInlineCode = () => wrapSelection('`', '`', 'code')
  const handleSubscript = () => wrapSelection('~', '~', t('下标'))
  const handleSuperscript = () => wrapSelection('^', '^', t('上标'))
  const handleHorizontalRule = () => replaceSelection('\n\n---\n\n')
  const handleBlockquote = () => toggleLinePrefix(/^\s{0,3}>\s?/, () => '> ', t('引用内容'))
  const handleUnorderedList = () => toggleLinePrefix(/^\s*[-+*]\s+(?!\[[ xX]\])/, () => '- ', t('列表项'))
  const handleOrderedList = () => toggleLinePrefix(/^\s*\d+[.)]\s+/, (index) => `${index + 1}. `, t('列表项'))
  const handleTaskList = () => toggleLinePrefix(/^\s*[-+*]\s+\[[ xX]\]\s+/, () => '- [ ] ', t('任务项'))

  const handleCodeBlock = () => {
    const selection = getSelection()
    if (!selection) return
    const text = selection.text || t('代码')
    const block = `\n\n\`\`\`\n${text}\n\`\`\`\n\n`
    const start = block.indexOf(text)
    replaceSelection(block, start, start + text.length)
  }

  const handleLink = () => {
    const selection = getSelection()
    if (!selection) return
    const label = selection.text || t('链接文本')
    const text = `[${label}](https://)`
    const urlStart = label.length + 3
    replaceSelection(text, urlStart, urlStart + 8)
  }

  const handleImageInsert = async () => {
    const imageId = await onImageUpload()
    if (!imageId) return
    const imageLabel = t('图片')
    const text = `\n\n<img src="arknote://${imageId}" alt="${imageLabel}" width="600" />\n\n`
    replaceSelection(text, text.indexOf(imageLabel), text.indexOf(imageLabel) + imageLabel.length)
  }

  const handleTable = (rows: number, cols: number) => {
    const header = `| ${Array.from({ length: cols }, (_, index) => t('列 {number}', { number: index + 1 })).join(' | ')} |`
    const separator = `| ${Array.from({ length: cols }, () => '---').join(' | ')} |`
    const body = Array.from(
      { length: rows },
      () => `| ${Array.from({ length: cols }, () => t('内容')).join(' | ')} |`
    )
    const table = `\n\n${[header, separator, ...body].join('\n')}\n\n`
    const firstCellLabel = t('列 {number}', { number: 1 })
    const firstCell = table.indexOf(firstCellLabel)
    replaceSelection(table, firstCell, firstCell + firstCellLabel.length)
    setActiveDropdown(null)
    setTableHover({ rows: 0, cols: 0 })
  }

  const handleFootnote = () => {
    const selection = getSelection()
    if (!selection) return
    const numbers = Array.from(selection.view.state.doc.toString().matchAll(/\[\^(\d+)\]/g))
      .map((match) => Number(match[1]))
      .filter(Number.isFinite)
    const number = (numbers.length > 0 ? Math.max(...numbers) : 0) + 1
    const label = selection.text || t('正文')
    const marker = `[^${number}]`
    const definition = t('脚注内容')
    const text = `${label}${marker}\n\n${marker}: ${definition}`
    const definitionStart = text.lastIndexOf(definition)
    replaceSelection(text, definitionStart, definitionStart + definition.length)
  }

  const handleDefinitionList = () => {
    const term = t('术语')
    const text = `${term}\n: ${t('定义内容')}`
    replaceSelection(`\n\n${text}\n\n`, 2, 2 + term.length)
  }

  const handleFontColor = (color: string) => {
    wrapSelection(`<span style="color: ${color}">`, '</span>', t('彩色文本'))
    setActiveDropdown(null)
  }

  const handleSequenceDiagram = () => {
    replaceSelection(`\n\n\`\`\`mermaid\nsequenceDiagram\n    participant A as ${t('参与者 A')}\n    participant B as ${t('参与者 B')}\n    A->>B: ${t('请求')}\n    B-->>A: ${t('响应')}\n\`\`\`\n\n`)
  }

  const handleFlowchart = () => {
    replaceSelection(`\n\n\`\`\`mermaid\nflowchart TD\n    A[${t('开始')}] --> B{${t('判断')}}\n    B -->|${t('是')}| C[${t('处理')}]\n    B -->|${t('否')}| D[${t('结束')}]\n    C --> D\n\`\`\`\n\n`)
  }

  const handlePieChart = () => {
    replaceSelection(`\n\n\`\`\`mermaid\npie title ${t('饼图示例')}\n    "${t('类别 {letter}', { letter: 'A' })}" : 40\n    "${t('类别 {letter}', { letter: 'B' })}" : 30\n    "${t('类别 {letter}', { letter: 'C' })}" : 20\n    "${t('类别 {letter}', { letter: 'D' })}" : 10\n\`\`\`\n\n`)
  }

  const handleEmoji = (emoji: string) => {
    replaceSelection(emoji)
    setActiveDropdown(null)
  }

  const getNotePath = useCallback((noteId: string): string => {
    const note = noteById.get(noteId)
    if (!note) return ''
    return getDirectoryPathString(note.directoryId)
  }, [noteById, getDirectoryPathString])

  const handleNoteLink = (noteId: string, noteTitle: string) => {
    replaceSelection(`[${noteTitle}](arknote-link://${noteId})`)
    setActiveDropdown(null)
    setNoteLinkSearch('')
  }

  const filteredNotes = noteLinkSearch.trim()
    ? notes.filter((note) => note.title.toLowerCase().includes(noteLinkSearch.toLowerCase()))
    : notes

  const dropdownButtonProps = (name: Exclude<DropdownName, null>) => ({
    type: 'button' as const,
    className: `toolbar-btn ${activeDropdown === name ? 'active' : ''}`,
    onMouseDown: (event: React.MouseEvent) => event.preventDefault(),
    onClick: (event: React.MouseEvent) => {
      event.stopPropagation()
      toggleDropdown(name)
    },
  })

  return (
    <div className="editor-toolbar">
      <div className="editor-toolbar-main">
        <div className="toolbar-group">
          <button ref={headingButtonRef} {...dropdownButtonProps('heading')} title={t('标题与正文')}>
            <Heading1 size={16} strokeWidth={1.5} />
          </button>
          <CommandButton title={t('引用')} onClick={handleBlockquote}>
            <Quote size={16} strokeWidth={1.5} />
          </CommandButton>
          <CommandButton title={t('代码块')} onClick={handleCodeBlock}>
            <CodeXml size={16} strokeWidth={1.5} />
          </CommandButton>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <CommandButton title={t('加粗 (Ctrl+B)')} onClick={handleBold}><Bold size={16} strokeWidth={1.5} /></CommandButton>
          <CommandButton title={t('斜体 (Ctrl+I)')} onClick={handleItalic}><Italic size={16} strokeWidth={1.5} /></CommandButton>
          <CommandButton title={t('插入文本 / 下划线')} onClick={handleUnderline}><Underline size={16} strokeWidth={1.5} /></CommandButton>
          <CommandButton title={t('删除线')} onClick={handleStrikethrough}><Strikethrough size={16} strokeWidth={1.5} /></CommandButton>
          <CommandButton title={t('文本高亮')} onClick={handleHighlight}><Highlighter size={16} strokeWidth={1.5} /></CommandButton>
          <button ref={colorButtonRef} {...dropdownButtonProps('color')} title={t('字体颜色')}>
            <Palette size={16} strokeWidth={1.5} />
          </button>
          <CommandButton title={t('内嵌代码')} onClick={handleInlineCode}><Code size={16} strokeWidth={1.5} /></CommandButton>
          <CommandButton title={t('下标')} onClick={handleSubscript}><Subscript size={16} strokeWidth={1.5} /></CommandButton>
          <CommandButton title={t('上标')} onClick={handleSuperscript}><Superscript size={16} strokeWidth={1.5} /></CommandButton>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <CommandButton title={t('无序列表')} onClick={handleUnorderedList}><List size={16} strokeWidth={1.5} /></CommandButton>
          <CommandButton title={t('有序列表')} onClick={handleOrderedList}><ListOrdered size={16} strokeWidth={1.5} /></CommandButton>
          <CommandButton title={t('任务列表')} onClick={handleTaskList}><ListChecks size={16} strokeWidth={1.5} /></CommandButton>
          <CommandButton title={t('定义列表')} onClick={handleDefinitionList}><ListTree size={16} strokeWidth={1.5} /></CommandButton>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <CommandButton title={t('水平线')} onClick={handleHorizontalRule}><Minus size={16} strokeWidth={1.5} /></CommandButton>
          <CommandButton title={t('插入链接')} onClick={handleLink}><Link2 size={16} strokeWidth={1.5} /></CommandButton>
          <CommandButton title={t('插入图片')} onClick={() => { void handleImageInsert() }}><ImagePlus size={16} strokeWidth={1.5} /></CommandButton>
          <button ref={tableButtonRef} {...dropdownButtonProps('table')} title={t('插入表格')}>
            <Table size={16} strokeWidth={1.5} />
          </button>
          <CommandButton title={t('插入脚注')} onClick={handleFootnote}><Pilcrow size={16} strokeWidth={1.5} /></CommandButton>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <CommandButton title={t('时序图')} onClick={handleSequenceDiagram}><GitBranch size={16} strokeWidth={1.5} /></CommandButton>
          <CommandButton title={t('流程图')} onClick={handleFlowchart}><Workflow size={16} strokeWidth={1.5} /></CommandButton>
          <CommandButton title={t('饼图')} onClick={handlePieChart}><PieChart size={16} strokeWidth={1.5} /></CommandButton>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <button ref={emojiButtonRef} {...dropdownButtonProps('emoji')} title={t('插入表情')}>
            <Smile size={16} strokeWidth={1.5} />
          </button>
          <button
            ref={noteLinkButtonRef}
            {...dropdownButtonProps('note-link')}
            onClick={(event) => {
              event.stopPropagation()
              setNoteLinkSearch('')
              toggleDropdown('note-link')
            }}
            title={t('插入笔记链接')}
          >
            <FileText size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {rightActions && <div className="editor-toolbar-actions">{rightActions}</div>}

      {activeDropdown === 'heading' && (
        <ToolbarPopover anchorRef={headingButtonRef} className="heading-picker-dropdown">
          {[1, 2, 3, 4, 5, 6].map((level) => (
            <button key={level} type="button" className="heading-picker-item" onClick={() => handleHeading(level)}>
              <span className="heading-picker-mark">H{level}</span>
              <span>{level === 1 ? t('一级标题') : t('{level} 级标题', { level })}</span>
            </button>
          ))}
          <button type="button" className="heading-picker-item" onClick={() => handleHeading(0)}>
            <Braces size={15} strokeWidth={1.5} />
            <span>{t('正文')}</span>
          </button>
        </ToolbarPopover>
      )}

      {activeDropdown === 'color' && (
        <ToolbarPopover anchorRef={colorButtonRef} className="color-picker-dropdown">
          <div className="color-grid">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                className="color-swatch"
                style={{ backgroundColor: color }}
                onClick={() => handleFontColor(color)}
                title={color}
              />
            ))}
          </div>
        </ToolbarPopover>
      )}

      {activeDropdown === 'table' && (
        <ToolbarPopover anchorRef={tableButtonRef} className="table-picker-dropdown">
          <div className="table-picker-label">
            {tableHover.rows > 0 ? t('{rows} 行 × {cols} 列', { rows: tableHover.rows, cols: tableHover.cols }) : t('选择表格大小')}
          </div>
          <div className="table-grid" onMouseLeave={() => setTableHover({ rows: 0, cols: 0 })}>
            {Array.from({ length: TABLE_MAX_ROWS }, (_, row) => (
              <div key={row} className="table-grid-row">
                {Array.from({ length: TABLE_MAX_COLS }, (_, col) => (
                  <button
                    key={col}
                    type="button"
                    className={`table-grid-cell ${row < tableHover.rows && col < tableHover.cols ? 'active' : ''}`}
                    onMouseEnter={() => setTableHover({ rows: row + 1, cols: col + 1 })}
                    onClick={() => handleTable(row + 1, col + 1)}
                    aria-label={t('插入 {rows} 行 {cols} 列表格', { rows: row + 1, cols: col + 1 })}
                  />
                ))}
              </div>
            ))}
          </div>
        </ToolbarPopover>
      )}

      {activeDropdown === 'emoji' && (
        <ToolbarPopover anchorRef={emojiButtonRef} className="emoji-picker-dropdown">
          <div className="emoji-grid">
            {EMOJI_LIST.map((emoji, index) => (
              <button key={index} type="button" className="emoji-btn" onClick={() => handleEmoji(emoji)}>
                {emoji}
              </button>
            ))}
          </div>
        </ToolbarPopover>
      )}

      {activeDropdown === 'note-link' && (
        <ToolbarPopover anchorRef={noteLinkButtonRef} className="note-link-dropdown">
          <input
            className="note-link-search"
            type="text"
            placeholder={t('搜索笔记...')}
            value={noteLinkSearch}
            onChange={(event) => setNoteLinkSearch(event.target.value)}
            autoFocus
          />
          <div className="note-link-list">
            {filteredNotes.length === 0 ? (
              <div className="note-link-empty">{t('未找到笔记')}</div>
            ) : (
              filteredNotes.slice(0, 20).map((note) => (
                <button
                  key={note.id}
                  type="button"
                  className="note-link-item"
                  onClick={() => handleNoteLink(note.id, note.title)}
                >
                  <span className="note-link-title">{note.title}</span>
                  <span className="note-link-path">{getNotePath(note.id)}</span>
                </button>
              ))
            )}
          </div>
        </ToolbarPopover>
      )}
    </div>
  )
}
