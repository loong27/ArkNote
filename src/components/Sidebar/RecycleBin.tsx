import React, { useState, useEffect, useCallback } from 'react'
import {
  Folder,
  FileText,
  Trash2,
  RotateCcw,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { ConfirmDialog } from '../Dialogs/ConfirmDialog'
import { useI18n } from '../../i18n/I18nProvider'

interface TrashItem {
  type: 'directory' | 'note'
  id: string
  name: string
  parentId: string | null
  directoryId?: string
  deletedAt: string
  originalPath: string
}

interface RecycleBinProps {
  onTrashLoaded?: (items: TrashItem[]) => void
}

export const RecycleBin: React.FC<RecycleBinProps> = ({ onTrashLoaded }) => {
  const { t, locale } = useI18n()
  const { loadData, currentNote, setCurrentNote, setViewMode, runAfterPendingSave } = useStore()
  const [trashItems, setTrashItems] = useState<TrashItem[]>([])
  const [loading, setLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; type: 'directory' | 'note'; name: string } | null>(null)
  const [confirmRestore, setConfirmRestore] = useState<{ id: string; type: 'directory' | 'note'; name: string } | null>(null)
  const [confirmEmpty, setConfirmEmpty] = useState(false)

  // Load trash items
  const loadTrash = useCallback(async () => {
    setLoading(true)
    try {
      const items = await window.electronAPI.trash.list()
      setTrashItems(items)
      onTrashLoaded?.(items)
    } catch (error) {
      console.error('Failed to load trash:', error)
    }
    setLoading(false)
  }, [onTrashLoaded])

  useEffect(() => {
    loadTrash()
  }, [loadTrash])

  // Expose loadTrash and emptyTrash via window for Sidebar to call
  useEffect(() => {
    (window as any).__recycleBinRefresh = loadTrash
    ;(window as any).__recycleBinSetConfirmEmpty = setConfirmEmpty
    return () => {
      delete (window as any).__recycleBinRefresh
      delete (window as any).__recycleBinSetConfirmEmpty
    }
  }, [loadTrash])

  // Handle restore with confirmation
  const handleRestore = async () => {
    if (!confirmRestore) return
    try {
      await window.electronAPI.trash.restore(confirmRestore.id, confirmRestore.type)
      await loadTrash()
      await loadData()
    } catch (error) {
      console.error('Restore failed:', error)
    }
    setConfirmRestore(null)
  }

  // Handle permanent delete
  const handlePermanentDelete = async () => {
    if (!confirmDelete) return
    try {
      await window.electronAPI.trash.deletePermanently(confirmDelete.id, confirmDelete.type)
      if (currentNote?.id === confirmDelete.id) {
        setCurrentNote(null)
        setViewMode('welcome')
      }
      await loadTrash()
    } catch (error) {
      console.error('Permanent delete failed:', error)
    }
    setConfirmDelete(null)
  }

  // Handle empty trash
  const handleEmptyTrash = async () => {
    try {
      await window.electronAPI.trash.empty()
      setCurrentNote(null)
      setViewMode('welcome')
      await loadTrash()
    } catch (error) {
      console.error('Empty trash failed:', error)
    }
    setConfirmEmpty(false)
  }

  const getDisplayPath = (item: TrashItem) => {
    const parts = item.originalPath.split('/').filter(Boolean)
    if (parts.length === 0) return item.name
    if (parts[parts.length - 1] === item.name) return parts.join(' / ')
    return [...parts, item.name].join(' / ')
  }

  // Handle note click (view in right pane, read-only)
  const handleNoteClick = async (noteId: string) => {
    try {
      const ok = await runAfterPendingSave(async () => {
        const content = await window.electronAPI.trash.getNoteContent(noteId)
        if (content) {
          const store = useStore.getState()
          store.setCurrentNote({
            id: noteId,
            content: content.content,
            metadata: content.metadata,
          })
          store.setViewMode('note')
          store.setIsEditing(false)
          store.setIsTrashNote(true)
        }
      })
      if (!ok) return
    } catch (error) {
      console.error('Failed to open trashed note:', error)
    }
  }

  return (
    <>
      {/* No header here - buttons moved to Sidebar toggle row */}
      <div className="sidebar-content" style={{ flex: 1, overflow: 'auto' }}>
        {loading && (
          <div className="empty-state" style={{ padding: '16px' }}>
            <p>{t('加载中...')}</p>
          </div>
        )}

        {!loading && trashItems.length === 0 && (
          <div className="empty-state" style={{ padding: '16px' }}>
            <Trash2 size={24} strokeWidth={1.5} />
            <p style={{ fontSize: 12 }}>{t('回收站为空')}</p>
          </div>
        )}

        {trashItems.map(item => {
          const displayPath = getDisplayPath(item)
          const deletedDate = new Date(item.deletedAt).toLocaleDateString(locale)

          return (
          <div
            key={`${item.type}-${item.id}`}
            className="tree-item trash-list-item"
            style={{ '--indent-level': 0 } as React.CSSProperties}
            onClick={() => item.type === 'note' && handleNoteClick(item.id)}
          >
            <span className="tree-icon">
              {item.type === 'directory' ? <Folder size={16} strokeWidth={1.5} /> : <FileText size={16} strokeWidth={1.5} />}
            </span>
            <div className="trash-list-main" title={displayPath}>
              <span className="trash-list-name">{displayPath}</span>
            </div>
            <span className="trash-list-date">{deletedDate}</span>
            <div className="tree-actions" style={{ opacity: 1 }}>
              <button
                className="icon-btn sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setConfirmRestore({ id: item.id, type: item.type, name: item.name })
                }}
                title={t('恢复')}
              >
                <RotateCcw size={14} strokeWidth={1.5} />
              </button>
              <button
                className="icon-btn sm danger"
                onClick={(e) => {
                  e.stopPropagation()
                  setConfirmDelete({ id: item.id, type: item.type, name: item.name })
                }}
                title={t('彻底删除')}
              >
                <Trash2 size={14} strokeWidth={1.5} />
              </button>
            </div>
          </div>
          )
        })}
      </div>

      {/* Confirm restore dialog */}
      <ConfirmDialog
        open={confirmRestore !== null}
        title={t('恢复确认')}
        message={t('确定要恢复「{name}」吗？', { name: confirmRestore?.name || '' })}
        confirmText={t('确认')}
        cancelText={t('取消')}
        onConfirm={handleRestore}
        onCancel={() => setConfirmRestore(null)}
      />

      {/* Confirm permanent delete dialog */}
      <ConfirmDialog
        open={confirmDelete !== null}
        title={t('彻底删除')}
        message={t('确定要彻底删除「{name}」吗？此操作不可撤销，所有内容及历史版本将被永久删除。', { name: confirmDelete?.name || '' })}
        confirmText={t('确认删除')}
        cancelText={t('取消')}
        danger
        onConfirm={handlePermanentDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Confirm empty trash dialog */}
      <ConfirmDialog
        open={confirmEmpty}
        title={t('清空回收站')}
        message={t('确定要清空回收站吗？所有内容将被永久删除，此操作不可撤销。')}
        confirmText={t('确认清空')}
        cancelText={t('取消')}
        danger
        onConfirm={handleEmptyTrash}
        onCancel={() => setConfirmEmpty(false)}
      />
    </>
  )
}
