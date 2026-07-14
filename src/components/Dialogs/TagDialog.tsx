import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { X, Trash2, Search } from 'lucide-react'
import { useStore } from '../../store/useStore'

export const TagDialog: React.FC = () => {
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

  const [searchQuery, setSearchQuery] = useState('')
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#89b4fa')
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Initialize selected tags from note
  useEffect(() => {
    if (tagNoteId) {
      const note = notes.find(n => n.id === tagNoteId)
      if (note) {
        setSelectedTagIds(new Set(note.tags))
      }
    }
  }, [tagNoteId, notes])

  const filteredTags = useMemo(() => {
    if (!searchQuery) return tags
    const lower = searchQuery.toLowerCase()
    return tags.filter(t => t.name.toLowerCase().includes(lower))
  }, [tags, searchQuery])

  // Check if tag has other associated notes (not counting current note)
  const getTagNoteCount = useCallback((tagId: string) => {
    return notes.filter(n => n.tags.includes(tagId) && n.id !== tagNoteId).length
  }, [notes, tagNoteId])

  const toggleTag = (tagId: string) => {
    const newSet = new Set(selectedTagIds)
    if (newSet.has(tagId)) {
      newSet.delete(tagId)
    } else {
      newSet.add(tagId)
    }
    setSelectedTagIds(newSet)
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return

    try {
      setError('')
      await window.electronAPI.tags.create(newTagName.trim(), newTagColor)
      await loadData()
      setNewTagName('')
      // Auto-select the new tag
      const updatedTags = await window.electronAPI.tags.list()
      const newTag = updatedTags.find(t => t.name === newTagName.trim())
      if (newTag) {
        const newSet = new Set(selectedTagIds)
        newSet.add(newTag.id)
        setSelectedTagIds(newSet)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建标签失败')
    }
  }

  const handleDeleteTag = async (tagId: string, e: React.MouseEvent) => {
    e.stopPropagation()

    try {
      const result = await window.electronAPI.tags.delete(tagId)
      if (!result.success) {
        setError(result.message)
        return
      }
      setError('')
      // Remove from selected
      const newSet = new Set(selectedTagIds)
      newSet.delete(tagId)
      setSelectedTagIds(newSet)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除标签失败')
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
    } catch (error) {
      console.error('Failed to save tags:', error)
    } finally {
      setSaving(false)
    }
  }

  if (!tagDialogOpen) return null

  return (
    <div className="dialog-overlay" onClick={closeTagDialog}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>添加标签</h3>
          <button className="icon-btn" onClick={closeTagDialog}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="dialog-body">
          {/* Create new tag */}
          <div className="tag-dialog-input-row">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="新标签名称 (回车添加)"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateTag()
              }}
            />
            <input
              type="color"
              value={newTagColor}
              onChange={(e) => setNewTagColor(e.target.value)}
              title="标签颜色"
            />
          </div>

          {error && (
            <div style={{
              color: 'var(--error)',
              fontSize: '13px',
              marginBottom: 12,
              padding: '8px 12px',
              background: '#f38ba822',
              borderRadius: 'var(--radius-md)',
            }}>
              {error}
            </div>
          )}

          {/* Search tags */}
          <div style={{ marginBottom: 12 }}>
            <div className="search-bar" style={{ padding: 0, border: 'none' }}>
              <div className="search-wrapper">
                <Search size={14} strokeWidth={1.5} className="search-icon" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索标签..."
                />
              </div>
            </div>
          </div>

          {/* Tag list */}
          <div className="tag-dialog-list">
            {filteredTags.map(tag => {
              const otherNoteCount = getTagNoteCount(tag.id)
              return (
                <div
                  key={tag.id}
                  className={`tag-dialog-item ${selectedTagIds.has(tag.id) ? 'selected' : ''}`}
                  onClick={() => toggleTag(tag.id)}
                >
                  <span className="tag-dot" style={{ backgroundColor: tag.color }} />
                  <span className="tag-name">{tag.name}</span>
                  {otherNoteCount > 0 && (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      ({otherNoteCount} 篇笔记)
                    </span>
                  )}
                  <button
                    className="tag-delete-btn icon-btn sm"
                    onClick={(e) => handleDeleteTag(tag.id, e)}
                    title={otherNoteCount > 0 ? '该标签关联了其他笔记，无法删除' : '删除标签'}
                  >
                    <Trash2 size={14} strokeWidth={1.5} />
                  </button>
                </div>
              )
            })}

            {filteredTags.length === 0 && (
              <div className="empty-state">
                <p>{searchQuery ? '未找到匹配的标签' : '暂无标签，请创建一个'}</p>
              </div>
            )}
          </div>
        </div>

        <div className="dialog-footer">
          <div style={{ flex: 1, fontSize: '13px', color: 'var(--text-muted)' }}>
            已选择 {selectedTagIds.size} 个标签
          </div>
          <button className="btn" onClick={closeTagDialog}>取消</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
