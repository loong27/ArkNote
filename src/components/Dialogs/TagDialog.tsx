import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { X, Trash2, Plus, Check } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useI18n } from '../../i18n/I18nProvider'

const TAG_COLOR_PRESETS = [
  '#f38ba8', '#fab387', '#f9e2af', '#a6e3a1', '#94e2d5',
  '#89dceb', '#89b4fa', '#b4befe', '#cba6f7', '#f5c2e7',
  '#ef4444', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899',
]

export const TagDialog: React.FC = () => {
  const { t } = useI18n()
  const {
    tagDialogOpen,
    tagNoteId,
    closeTagDialog,
    tags,
    notes,
    loadData,
    refreshCurrentNote,
    runAfterPendingSave,
  } = useStore()

  const [query, setQuery] = useState('')
  const [newTagColor, setNewTagColor] = useState('#89b4fa')
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set())
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const paletteRef = useRef<HTMLDivElement>(null)

  // Reset local UI only when the dialog opens or switches notes — not when
  // `notes` refreshes after create/delete (that would wipe in-progress selection).
  useEffect(() => {
    if (!tagDialogOpen) return
    setQuery('')
    setError('')
    setHighlightIndex(0)
    setColorPickerOpen(false)
    setNewTagColor('#89b4fa')
    const note = tagNoteId
      ? useStore.getState().notes.find(n => n.id === tagNoteId)
      : null
    setSelectedTagIds(new Set(note?.tags ?? []))
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [tagDialogOpen, tagNoteId])

  useEffect(() => {
    if (!colorPickerOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      if (paletteRef.current?.contains(event.target as Node)) return
      setColorPickerOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [colorPickerOpen])

  const filteredTags = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return tags
    return tags.filter(tag => tag.name.toLowerCase().includes(trimmed))
  }, [tags, query])

  const exactMatch = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return null
    return tags.find(tag => tag.name.toLowerCase() === trimmed) ?? null
  }, [tags, query])

  const canCreate = query.trim().length > 0 && !exactMatch

  // Virtual list rows: optional create row + filtered tags
  const rowCount = (canCreate ? 1 : 0) + filteredTags.length

  useEffect(() => {
    setHighlightIndex(0)
  }, [query, canCreate, filteredTags.length])

  const getTagNoteCount = useCallback((tagId: string) => {
    return notes.filter(n => n.tags.includes(tagId) && n.id !== tagNoteId).length
  }, [notes, tagNoteId])

  const selectedTags = useMemo(
    () => tags.filter(tag => selectedTagIds.has(tag.id)),
    [tags, selectedTagIds],
  )

  const toggleTag = useCallback((tagId: string) => {
    setSelectedTagIds(prev => {
      const next = new Set(prev)
      if (next.has(tagId)) next.delete(tagId)
      else next.add(tagId)
      return next
    })
    setError('')
  }, [])

  const removeSelected = useCallback((tagId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedTagIds(prev => {
      const next = new Set(prev)
      next.delete(tagId)
      return next
    })
  }, [])

  const handleCreateTag = useCallback(async () => {
    const name = query.trim()
    if (!name || creating) return

    setCreating(true)
    try {
      setError('')
      const created = await window.electronAPI.tags.create(name, newTagColor)
      await loadData()
      setSelectedTagIds(prev => {
        const next = new Set(prev)
        next.add(created.id)
        return next
      })
      setQuery('')
      setColorPickerOpen(false)
      // Rotate to next preset for consecutive creates
      const idx = TAG_COLOR_PRESETS.indexOf(newTagColor)
      setNewTagColor(TAG_COLOR_PRESETS[(idx + 1) % TAG_COLOR_PRESETS.length] ?? '#89b4fa')
      inputRef.current?.focus()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('创建标签失败'))
    } finally {
      setCreating(false)
    }
  }, [query, creating, newTagColor, loadData, t])

  const handleDeleteTag = async (tagId: string, e: React.MouseEvent) => {
    e.stopPropagation()

    try {
      const result = await window.electronAPI.tags.delete(tagId)
      if (!result.success) {
        setError(t(result.message))
        return
      }
      setError('')
      setSelectedTagIds(prev => {
        const next = new Set(prev)
        next.delete(tagId)
        return next
      })
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('删除标签失败'))
    }
  }

  const activateHighlighted = useCallback(() => {
    if (rowCount === 0) return
    const index = Math.min(highlightIndex, rowCount - 1)
    if (canCreate && index === 0) {
      void handleCreateTag()
      return
    }
    const tagIndex = canCreate ? index - 1 : index
    const tag = filteredTags[tagIndex]
    if (tag) {
      toggleTag(tag.id)
      setQuery('')
    }
  }, [rowCount, highlightIndex, canCreate, handleCreateTag, filteredTags, toggleTag])

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      if (colorPickerOpen) {
        setColorPickerOpen(false)
        return
      }
      closeTagDialog()
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
      if (exactMatch) {
        toggleTag(exactMatch.id)
        setQuery('')
        return
      }
      if (canCreate && (rowCount === 0 || highlightIndex === 0)) {
        void handleCreateTag()
        return
      }
      activateHighlighted()
    }
  }

  const handleSave = async () => {
    if (!tagNoteId) return

    setSaving(true)
    try {
      const ok = await runAfterPendingSave(async () => {
        await window.electronAPI.tags.assign(tagNoteId, Array.from(selectedTagIds))
        await loadData()
        await refreshCurrentNote()
        closeTagDialog()
      })
      if (!ok) return
    } catch (err) {
      console.error('Failed to save tags:', err)
    } finally {
      setSaving(false)
    }
  }

  if (!tagDialogOpen) return null

  return (
    <div className="dialog-overlay" onClick={closeTagDialog}>
      <div className="dialog tag-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>{t('添加标签')}</h3>
          <button className="icon-btn" onClick={closeTagDialog} aria-label={t('取消')}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="dialog-body tag-dialog-body">
          {selectedTags.length > 0 && (
            <div className="tag-dialog-selected">
              {selectedTags.map(tag => (
                <span
                  key={tag.id}
                  className="tag-dialog-chip"
                  style={{
                    backgroundColor: `${tag.color}22`,
                    borderColor: `${tag.color}88`,
                  }}
                >
                  <span className="tag-dot" style={{ backgroundColor: tag.color }} />
                  <span className="tag-dialog-chip-name">{tag.name}</span>
                  <button
                    type="button"
                    className="tag-dialog-chip-remove"
                    onClick={(e) => removeSelected(tag.id, e)}
                    aria-label={t('删除标签')}
                  >
                    <X size={12} strokeWidth={2} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="tag-dialog-combobox" ref={paletteRef}>
            <input
              ref={inputRef}
              type="text"
              className="tag-dialog-input"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setError('')
              }}
              onKeyDown={handleInputKeyDown}
              placeholder={t('搜索或创建标签…')}
              autoComplete="off"
            />
            <button
              type="button"
              className="tag-dialog-color-btn"
              style={{ backgroundColor: newTagColor }}
              onClick={() => setColorPickerOpen(open => !open)}
              title={t('标签颜色')}
              aria-label={t('标签颜色')}
            />
            {colorPickerOpen && (
              <div className="tag-dialog-palette">
                {TAG_COLOR_PRESETS.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`tag-dialog-palette-swatch ${newTagColor === color ? 'active' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => {
                      setNewTagColor(color)
                      setColorPickerOpen(false)
                      inputRef.current?.focus()
                    }}
                    title={color}
                  />
                ))}
                <label className="tag-dialog-palette-custom" title={t('自定义颜色')}>
                  <input
                    type="color"
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                  />
                </label>
              </div>
            )}
          </div>

          {error && <div className="tag-dialog-error">{error}</div>}

          <div className="tag-dialog-list" role="listbox">
            {canCreate && (
              <button
                type="button"
                className={`tag-dialog-create ${highlightIndex === 0 ? 'highlighted' : ''}`}
                onClick={() => void handleCreateTag()}
                onMouseEnter={() => setHighlightIndex(0)}
                disabled={creating}
              >
                <Plus size={16} strokeWidth={1.75} />
                <span>{t('创建「{name}」', { name: query.trim() })}</span>
                <span
                  className="tag-dialog-create-dot"
                  style={{ backgroundColor: newTagColor }}
                />
              </button>
            )}

            {filteredTags.map((tag, index) => {
              const rowIndex = (canCreate ? 1 : 0) + index
              const otherNoteCount = getTagNoteCount(tag.id)
              const selected = selectedTagIds.has(tag.id)
              return (
                <div
                  key={tag.id}
                  role="option"
                  aria-selected={selected}
                  className={[
                    'tag-dialog-item',
                    selected ? 'selected' : '',
                    highlightIndex === rowIndex ? 'highlighted' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => toggleTag(tag.id)}
                  onMouseEnter={() => setHighlightIndex(rowIndex)}
                >
                  <span className="tag-dialog-check" aria-hidden>
                    {selected ? <Check size={14} strokeWidth={2.25} /> : null}
                  </span>
                  <span className="tag-dot" style={{ backgroundColor: tag.color }} />
                  <span className="tag-name">{tag.name}</span>
                  {otherNoteCount > 0 && (
                    <span className="tag-dialog-count">
                      {t('({count} 篇笔记)', { count: otherNoteCount })}
                    </span>
                  )}
                  <button
                    type="button"
                    className="tag-delete-btn icon-btn sm"
                    onClick={(e) => handleDeleteTag(tag.id, e)}
                    title={otherNoteCount > 0 ? t('该标签关联了其他笔记，无法删除') : t('删除标签')}
                    disabled={otherNoteCount > 0}
                  >
                    <Trash2 size={14} strokeWidth={1.5} />
                  </button>
                </div>
              )
            })}

            {filteredTags.length === 0 && !canCreate && (
              <div className="tag-dialog-empty">
                <p>{query.trim() ? t('未找到匹配的标签') : t('暂无标签，请创建一个')}</p>
              </div>
            )}
          </div>
        </div>

        <div className="dialog-footer">
          <div className="tag-dialog-footer-count">
            {t('已选择 {count} 个标签', { count: selectedTagIds.size })}
          </div>
          <button type="button" className="btn" onClick={closeTagDialog}>{t('取消')}</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? t('保存中...') : t('保存')}
          </button>
        </div>
      </div>
    </div>
  )
}
