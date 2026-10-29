import React, { useState, useMemo, useEffect } from 'react'
import { Tag as TagIcon, FileText, Pencil, Trash2 } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { SearchBar } from './SearchBar'
import type { NoteMetadata } from '../../types'
import { useI18n } from '../../i18n/I18nProvider'

export const TagList: React.FC = () => {
  const { t } = useI18n()
  const { tags, tagNoteCounts, openNote, selectedTagId, setSelectedTagId, runAfterPendingSave, loadData } = useStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [tagNotes, setTagNotes] = useState<NoteMetadata[]>([])
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const filteredTags = useMemo(() => {
    if (!searchQuery) return tags
    const lower = searchQuery.toLowerCase()
    return tags.filter(tag => tag.name.toLowerCase().includes(lower))
  }, [tags, searchQuery])

  useEffect(() => {
    if (!selectedTagId) {
      setTagNotes([])
      return
    }

    const loadNotes = async () => {
      try {
        const result = await window.electronAPI.tags.getNotesForTag(selectedTagId)
        setTagNotes(result)
      } catch (error) {
        console.error('Failed to load tag notes:', error)
      }
    }
    void loadNotes()
  }, [selectedTagId])

  const handleTagClick = async (tagId: string) => {
    if (selectedTagId === tagId) {
      const ok = await runAfterPendingSave(async () => {
        setSelectedTagId(null)
      })
      if (!ok) return
    } else {
      const ok = await runAfterPendingSave(async () => {
        setSelectedTagId(tagId)
      })
      if (!ok) return
    }
  }

  const handleRename = async (tagId: string) => {
    const name = renameValue.trim()
    if (!name) return
    try {
      await window.electronAPI.tags.rename(tagId, name)
      setRenamingId(null)
      await loadData()
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error))
    }
  }

  const handleDelete = async (tagId: string) => {
    const count = tagNoteCounts.get(tagId) || 0
    const confirmed = count > 0
      ? window.confirm(t('该标签关联了 {count} 篇笔记。是否移除所有关联并删除标签？', { count }))
      : window.confirm(t('确认删除此标签？'))
    if (!confirmed) return
    const result = await window.electronAPI.tags.delete(tagId, count > 0)
    if (!result.success) {
      alert(t(result.message))
      return
    }
    if (selectedTagId === tagId) setSelectedTagId(null)
    await loadData()
  }

  return (
    <>
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={t('搜索标签...')}
      />

      <div className="sidebar-content">
        {selectedTagId ? (
          <>
            <div
              className="tree-item"
              style={{ '--indent-level': 0 } as React.CSSProperties}
              onClick={() => setSelectedTagId(null)}
            >
              <span className="tree-icon" style={{ color: 'var(--accent)' }}>
                ←
              </span>
              <span className="tree-label" style={{ color: 'var(--accent)' }}>
                {t('返回标签列表')}
              </span>
            </div>

            {tagNotes.length === 0 ? (
              <div className="empty-state">
                <p>{t('该标签下暂无笔记')}</p>
              </div>
            ) : (
              tagNotes.map(note => (
                <div
                  key={note.id}
                  className="tree-item"
                  style={{ '--indent-level': 0 } as React.CSSProperties}
                  onClick={() => void openNote(note.id)}
                >
                  <span className="tree-icon">
                    <FileText size={16} strokeWidth={1.5} />
                  </span>
                  <span className="tree-label">{note.title}</span>
                </div>
              ))
            )}
          </>
        ) : (
          <div className="tag-list">
            {filteredTags.map(tag => (
              <div
                key={tag.id}
                className={`tag-item ${selectedTagId === tag.id ? 'active' : ''}`}
                onClick={() => void handleTagClick(tag.id)}
              >
                <span
                  className="tag-dot"
                  style={{ backgroundColor: tag.color }}
                />
                {renamingId === tag.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleRename(tag.id)
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                    onBlur={() => void handleRename(tag.id)}
                    style={{ flex: 1, fontSize: 13, background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', padding: '2px 6px' }}
                  />
                ) : (
                  <span className="tag-name">{tag.name}</span>
                )}
                <span className="tag-count">
                  {tagNoteCounts.get(tag.id) || 0}
                </span>
                <button
                  className="icon-btn sm"
                  title={t('重命名')}
                  onClick={(e) => {
                    e.stopPropagation()
                    setRenamingId(tag.id)
                    setRenameValue(tag.name)
                  }}
                >
                  <Pencil size={12} />
                </button>
                <button
                  className="icon-btn sm"
                  title={t('删除')}
                  onClick={(e) => {
                    e.stopPropagation()
                    void handleDelete(tag.id)
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}

            {filteredTags.length === 0 && (
              <div className="empty-state">
                <TagIcon size={32} strokeWidth={1.5} />
                <p>{searchQuery ? t('未找到匹配的标签') : t('暂无标签')}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
