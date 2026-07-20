import React from 'react'
import { X } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useI18n } from '../i18n/I18nProvider'

export const NoteTabs: React.FC = () => {
  const { t } = useI18n()
  const {
    noteTabs,
    activeNoteTabId,
    noteById,
    currentNote,
    viewMode,
    isTrashNote,
    saveState,
    activateNoteTab,
    closeNoteTab,
  } = useStore()

  if (noteTabs.length === 0) return null

  const getTitle = (noteId: string) => {
    if (currentNote?.id === noteId) {
      return currentNote.metadata.title || t('未命名笔记')
    }
    return noteById.get(noteId)?.title || t('未命名笔记')
  }

  return (
    <div className="note-tabs" role="tablist" aria-label={t('已打开的笔记')}>
      {noteTabs.map((tab) => {
        const isActive = viewMode === 'note' && !isTrashNote && activeNoteTabId === tab.noteId
        const isDirty = saveState.noteId === tab.noteId && saveState.phase === 'dirty'

        return (
          <div
            key={tab.noteId}
            role="tab"
            tabIndex={0}
            aria-selected={isActive}
            className={`note-tab ${isActive ? 'active' : ''}`}
            onClick={() => void activateNoteTab(tab.noteId)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                void activateNoteTab(tab.noteId)
              }
            }}
          >
            {isDirty && <span className="note-tab-dirty" />}
            <span className="note-tab-title" title={getTitle(tab.noteId)}>{getTitle(tab.noteId)}</span>
            <button
              className="note-tab-close"
              aria-label={t('关闭 {title}', { title: getTitle(tab.noteId) })}
              onClick={(e) => {
                e.stopPropagation()
                void closeNoteTab(tab.noteId)
              }}
            >
              <X size={12} strokeWidth={1.8} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
