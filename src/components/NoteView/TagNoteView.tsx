import React, { useMemo } from 'react'
import { FileText, LayoutGrid, LayoutList } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { format } from 'date-fns'
import { useI18n } from '../../i18n/I18nProvider'

export const TagNoteView: React.FC = () => {
  const { t } = useI18n()
  const {
    selectedTagId,
    tags,
    notes,
    directoryViewMode,
    setDirectoryViewMode,
    setSelectedTagId,
    setViewMode,
    openNote,
    runAfterPendingSave,
  } = useStore()

  const tagNotes = useMemo(() => {
    if (!selectedTagId) return []
    return notes.filter(n => n.tags.includes(selectedTagId))
  }, [notes, selectedTagId])

  const selectedTag = useMemo(
    () => tags.find(t => t.id === selectedTagId),
    [tags, selectedTagId]
  )

  if (!selectedTagId || !selectedTag) {
    return (
      <div className="empty-state">
        <p>{t('未选择标签')}</p>
      </div>
    )
  }

  return (
    <div className="directory-view">
      {/* Breadcrumb */}
      <div className="directory-view-breadcrumb">
        <span onClick={async () => {
          const ok = await runAfterPendingSave(async () => {
            setSelectedTagId(null)
            setViewMode('welcome')
          })
          if (!ok) return
        }}>
          {t('首页')}
        </span>
        <span className="separator">/</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
          {selectedTag.name}
        </span>
      </div>

      {/* Header */}
      <div className="directory-view-header">
        <h2>
          <span
            className="tag-dot"
            style={{
              backgroundColor: selectedTag.color,
              display: 'inline-block',
              width: 12,
              height: 12,
              borderRadius: '50%',
              marginRight: 8,
            }}
          />
          {selectedTag.name}
        </h2>
        <button
          className="icon-btn"
          onClick={() => setDirectoryViewMode(directoryViewMode === 'card' ? 'list' : 'card')}
          data-tooltip={directoryViewMode === 'card' ? t('列表视图') : t('卡片视图')}
        >
          {directoryViewMode === 'card'
            ? <LayoutList size={18} strokeWidth={1.5} />
            : <LayoutGrid size={18} strokeWidth={1.5} />}
        </button>
      </div>

      {/* Notes */}
      {tagNotes.length > 0 ? (
        <div className={directoryViewMode === 'card' ? 'directory-grid' : 'directory-list'}>
          {tagNotes.map(note => (
            directoryViewMode === 'card' ? (
              <div
                key={note.id}
                className="directory-card"
                onClick={() => openNote(note.id)}
              >
                <div className="card-icon">
                  <FileText size={24} strokeWidth={1.5} />
                </div>
                <div className="card-info">
                  <div className="card-title">{note.title}</div>
                  <div className="card-meta">
                    {format(new Date(note.updatedAt), 'yyyy-MM-dd HH:mm')}
                  </div>
                </div>
              </div>
            ) : (
              <div
                key={note.id}
                className="directory-list-item"
                onClick={() => openNote(note.id)}
              >
                <FileText size={18} strokeWidth={1.5} />
                <span className="list-item-title">{note.title}</span>
                <span className="list-item-meta">
                  {format(new Date(note.updatedAt), 'yyyy-MM-dd HH:mm')}
                </span>
              </div>
            )
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <FileText size={32} strokeWidth={1.5} />
          <p>{t('该标签下暂无笔记')}</p>
        </div>
      )}
    </div>
  )
}
