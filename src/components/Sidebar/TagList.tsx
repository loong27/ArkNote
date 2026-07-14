import React, { useState, useMemo, useEffect } from 'react'
import { Tag as TagIcon, FileText } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { SearchBar } from './SearchBar'
import type { NoteMetadata } from '../../types'

export const TagList: React.FC = () => {
  const { tags, tagNoteCounts, openNote, selectedTagId, setSelectedTagId, runAfterPendingSave } = useStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [tagNotes, setTagNotes] = useState<NoteMetadata[]>([])

  const filteredTags = useMemo(() => {
    if (!searchQuery) return tags
    const lower = searchQuery.toLowerCase()
    return tags.filter(t => t.name.toLowerCase().includes(lower))
  }, [tags, searchQuery])

  // Load notes for selected tag
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
    loadNotes()
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

  const handleNoteClick = (noteId: string) => {
    openNote(noteId)
  }

  return (
    <>
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="搜索标签..."
      />

      <div className="sidebar-content">
        {selectedTagId ? (
          // Show notes for selected tag
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
                返回标签列表
              </span>
            </div>

            {tagNotes.length === 0 ? (
              <div className="empty-state">
                <p>该标签下暂无笔记</p>
              </div>
            ) : (
              tagNotes.map(note => (
                <div
                  key={note.id}
                  className="tree-item"
                  style={{ '--indent-level': 0 } as React.CSSProperties}
                  onClick={() => handleNoteClick(note.id)}
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
          // Show tag list
          <div className="tag-list">
            {filteredTags.map(tag => (
              <div
                key={tag.id}
                className={`tag-item ${selectedTagId === tag.id ? 'active' : ''}`}
                onClick={() => handleTagClick(tag.id)}
              >
                <span
                  className="tag-dot"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="tag-name">{tag.name}</span>
                <span className="tag-count">
                  {tagNoteCounts.get(tag.id) || 0}
                </span>
              </div>
            ))}

            {filteredTags.length === 0 && (
              <div className="empty-state">
                <TagIcon size={32} strokeWidth={1.5} />
                <p>{searchQuery ? '未找到匹配的标签' : '暂无标签'}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
