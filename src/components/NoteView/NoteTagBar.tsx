import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useI18n } from '../../i18n/I18nProvider'

const TAG_COLOR_PRESETS = [
  '#f38ba8', '#fab387', '#f9e2af', '#a6e3a1', '#94e2d5',
  '#89dceb', '#89b4fa', '#b4befe', '#cba6f7', '#f5c2e7',
  '#ef4444', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899',
]

interface Props {
  noteId: string
  tagIds: string[]
  readOnly?: boolean
}

export const NoteTagBar: React.FC<Props> = ({ noteId, tagIds, readOnly = false }) => {
  const { t } = useI18n()
  const tags = useStore(s => s.tags)
  const {
    loadData,
    refreshCurrentNote,
    runAfterPendingSave,
    setSelectedTagId,
    setSidebarTab,
  } = useStore()

  const [popoverOpen, setPopoverOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [newTagColor, setNewTagColor] = useState('#89b4fa')
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const paletteRef = useRef<HTMLDivElement>(null)

  const noteTags = useMemo(
    () => tags.filter(tag => tagIds.includes(tag.id)),
    [tags, tagIds],
  )

  const availableTags = useMemo(
    () => tags.filter(tag => !tagIds.includes(tag.id)),
    [tags, tagIds],
  )

  const filteredTags = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return availableTags
    return availableTags.filter(tag => tag.name.toLowerCase().includes(trimmed))
  }, [availableTags, query])

  const exactMatch = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return null
    return tags.find(tag => tag.name.toLowerCase() === trimmed) ?? null
  }, [tags, query])

  const canCreate = query.trim().length > 0 && !exactMatch
  const rowCount = (canCreate ? 1 : 0) + filteredTags.length

  useEffect(() => {
    if (!popoverOpen) return
    setQuery('')
    setError('')
    setHighlightIndex(0)
    setColorPickerOpen(false)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [popoverOpen])

  useEffect(() => {
    setHighlightIndex(0)
  }, [query, canCreate, filteredTags.length])

  useEffect(() => {
    if (!popoverOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return
      setPopoverOpen(false)
      setColorPickerOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (colorPickerOpen) {
          setColorPickerOpen(false)
          return
        }
        setPopoverOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [popoverOpen, colorPickerOpen])

  const assignTags = useCallback(async (nextIds: string[]) => {
    setBusy(true)
    try {
      setError('')
      const ok = await runAfterPendingSave(async () => {
        await window.electronAPI.tags.assign(noteId, nextIds)
        await loadData()
        await refreshCurrentNote()
      })
      if (!ok) {
        setError(t('操作失败，请重试'))
      }
      return ok
    } catch (err) {
      setError(err instanceof Error ? err.message : t('操作失败，请重试'))
      return false
    } finally {
      setBusy(false)
    }
  }, [noteId, runAfterPendingSave, loadData, refreshCurrentNote, t])

  const handleOpenTag = useCallback((tagId: string) => {
    setSelectedTagId(tagId)
    setSidebarTab('tags')
  }, [setSelectedTagId, setSidebarTab])

  const handleUnassign = useCallback(async (tagId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (readOnly || busy) return
    await assignTags(tagIds.filter(id => id !== tagId))
  }, [readOnly, busy, assignTags, tagIds])

  const handleAssign = useCallback(async (tagId: string) => {
    if (readOnly || busy || tagIds.includes(tagId)) return
    const ok = await assignTags([...tagIds, tagId])
    if (ok) {
      setQuery('')
      setHighlightIndex(0)
      inputRef.current?.focus()
    }
  }, [readOnly, busy, assignTags, tagIds])

  const handleCreateAndAssign = useCallback(async () => {
    const name = query.trim()
    if (!name || readOnly || busy) return

    setBusy(true)
    try {
      setError('')
      const ok = await runAfterPendingSave(async () => {
        const created = await window.electronAPI.tags.create(name, newTagColor)
        await window.electronAPI.tags.assign(noteId, [...tagIds, created.id])
        await loadData()
        await refreshCurrentNote()
      })
      if (!ok) {
        setError(t('创建标签失败'))
        return
      }
      setQuery('')
      setColorPickerOpen(false)
      const idx = TAG_COLOR_PRESETS.indexOf(newTagColor)
      setNewTagColor(TAG_COLOR_PRESETS[(idx + 1) % TAG_COLOR_PRESETS.length] ?? '#89b4fa')
      inputRef.current?.focus()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('创建标签失败'))
    } finally {
      setBusy(false)
    }
  }, [
    query,
    readOnly,
    busy,
    runAfterPendingSave,
    newTagColor,
    noteId,
    tagIds,
    loadData,
    refreshCurrentNote,
    t,
  ])

  const activateHighlighted = useCallback(() => {
    if (rowCount === 0) return
    const index = Math.min(highlightIndex, rowCount - 1)
    if (canCreate && index === 0) {
      void handleCreateAndAssign()
      return
    }
    const tagIndex = canCreate ? index - 1 : index
    const tag = filteredTags[tagIndex]
    if (tag) void handleAssign(tag.id)
  }, [rowCount, highlightIndex, canCreate, handleCreateAndAssign, filteredTags, handleAssign])

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      if (colorPickerOpen) {
        setColorPickerOpen(false)
        return
      }
      setPopoverOpen(false)
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (rowCount === 0) return
      setHighlightIndex(prev => (prev + 1) % rowCount)
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (rowCount === 0) return
      setHighlightIndex(prev => (prev - 1 + rowCount) % rowCount)
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      if (exactMatch && !tagIds.includes(exactMatch.id)) {
        void handleAssign(exactMatch.id)
        return
      }
      if (exactMatch && tagIds.includes(exactMatch.id)) {
        setQuery('')
        return
      }
      if (canCreate && (rowCount === 0 || highlightIndex === 0)) {
        void handleCreateAndAssign()
        return
      }
      activateHighlighted()
    }
  }

  return (
    <div className="note-tag-bar" ref={rootRef}>
      <div className="note-tag-bar-chips">
        {noteTags.length === 0 ? (
          <span className="note-tag-bar-empty">{t('暂无关联标签')}</span>
        ) : (
          noteTags.map(tag => (
            <span
              key={tag.id}
              className="note-tag-chip"
              style={{
                backgroundColor: `${tag.color}22`,
                borderColor: `${tag.color}88`,
              }}
              title={tag.name}
            >
              <button
                type="button"
                className="note-tag-chip-main"
                onClick={() => handleOpenTag(tag.id)}
              >
                <span className="tag-dot" style={{ backgroundColor: tag.color }} />
                <span className="note-tag-chip-name">{tag.name}</span>
              </button>
              {!readOnly && (
                <button
                  type="button"
                  className="note-tag-chip-remove"
                  onClick={(e) => void handleUnassign(tag.id, e)}
                  aria-label={t('解除关联')}
                  title={t('解除关联')}
                >
                  <X size={12} strokeWidth={2} />
                </button>
              )}
            </span>
          ))
        )}

        {!readOnly && (
          <button
            type="button"
            className={`note-tag-add-btn ${popoverOpen ? 'active' : ''}`}
            onClick={() => setPopoverOpen(open => !open)}
            aria-label={t('关联标签')}
            title={t('关联标签')}
            disabled={busy}
          >
            <Plus size={14} strokeWidth={2} />
            {noteTags.length === 0 && <span>{t('关联标签')}</span>}
          </button>
        )}
      </div>

      {popoverOpen && !readOnly && (
        <div className="note-tag-popover" onClick={(e) => e.stopPropagation()}>
          <div className="note-tag-popover-combobox" ref={paletteRef}>
            <input
              ref={inputRef}
              type="text"
              className="note-tag-popover-input"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setError('')
              }}
              onKeyDown={handleInputKeyDown}
              placeholder={t('搜索或创建标签…')}
              autoComplete="off"
              disabled={busy}
            />
            <button
              type="button"
              className="note-tag-popover-color-btn"
              style={{ backgroundColor: newTagColor }}
              onClick={() => setColorPickerOpen(open => !open)}
              title={t('标签颜色')}
              aria-label={t('标签颜色')}
            />
            {colorPickerOpen && (
              <div className="note-tag-popover-palette">
                {TAG_COLOR_PRESETS.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`note-tag-popover-swatch ${newTagColor === color ? 'active' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => {
                      setNewTagColor(color)
                      setColorPickerOpen(false)
                      inputRef.current?.focus()
                    }}
                    title={color}
                  />
                ))}
                <label className="note-tag-popover-custom" title={t('自定义颜色')}>
                  <input
                    type="color"
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                  />
                </label>
              </div>
            )}
          </div>

          {error && <div className="note-tag-popover-error">{error}</div>}

          <div className="note-tag-popover-list" role="listbox">
            {canCreate && (
              <button
                type="button"
                className={`note-tag-popover-create ${highlightIndex === 0 ? 'highlighted' : ''}`}
                onClick={() => void handleCreateAndAssign()}
                onMouseEnter={() => setHighlightIndex(0)}
                disabled={busy}
              >
                <Plus size={16} strokeWidth={1.75} />
                <span>{t('创建「{name}」', { name: query.trim() })}</span>
                <span
                  className="note-tag-popover-create-dot"
                  style={{ backgroundColor: newTagColor }}
                />
              </button>
            )}

            {filteredTags.map((tag, index) => {
              const rowIndex = (canCreate ? 1 : 0) + index
              return (
                <button
                  key={tag.id}
                  type="button"
                  role="option"
                  className={[
                    'note-tag-popover-item',
                    highlightIndex === rowIndex ? 'highlighted' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => void handleAssign(tag.id)}
                  onMouseEnter={() => setHighlightIndex(rowIndex)}
                  disabled={busy}
                >
                  <span className="tag-dot" style={{ backgroundColor: tag.color }} />
                  <span className="note-tag-popover-item-name">{tag.name}</span>
                </button>
              )
            })}

            {filteredTags.length === 0 && !canCreate && (
              <div className="note-tag-popover-empty">
                <p>
                  {query.trim()
                    ? t('未找到匹配的标签')
                    : availableTags.length === 0
                      ? (tags.length === 0 ? t('暂无标签，请创建一个') : t('已关联全部标签'))
                      : t('暂无标签，请创建一个')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
