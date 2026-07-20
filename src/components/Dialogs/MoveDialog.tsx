import React, { useState, useMemo, useCallback } from 'react'
import { X, Folder, FolderOpen, ChevronRight, Search } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { Directory } from '../../types'
import { useI18n } from '../../i18n/I18nProvider'

export const MoveDialog: React.FC = () => {
  const { t } = useI18n()
  const {
    moveDialogOpen,
    moveNoteId,
    closeMoveDialog,
    directories,
    childDirsByParentId,
    getDirectoryPathString,
    loadData,
    refreshCurrentNote,
    runAfterPendingSave,
  } = useStore()

  const [selectedDirId, setSelectedDirId] = useState<string | null>(null)
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [moving, setMoving] = useState(false)

  const filteredDirs = useMemo(() => {
    if (!searchQuery) return directories
    const lower = searchQuery.toLowerCase()
    return directories.filter(d => d.name.toLowerCase().includes(lower))
  }, [directories, searchQuery])

  const rootDirs = useMemo(
    () => filteredDirs.filter(d => d.parentId === null).sort((a, b) => a.order - b.order),
    [filteredDirs]
  )

  const getChildDirs = useCallback(
    (parentId: string) => (childDirsByParentId.get(parentId) ?? []).filter(d => filteredDirs.includes(d)),
    [childDirsByParentId, filteredDirs]
  )

  const toggleExpand = (dirId: string) => {
    const newSet = new Set(expandedDirs)
    if (newSet.has(dirId)) {
      newSet.delete(dirId)
    } else {
      newSet.add(dirId)
    }
    setExpandedDirs(newSet)
  }

  const handleMove = async () => {
    if (!moveNoteId || !selectedDirId) return

    setMoving(true)
    try {
      const ok = await runAfterPendingSave(async () => {
        await window.electronAPI.notes.move(moveNoteId, selectedDirId)
        await loadData()
        await refreshCurrentNote()
        closeMoveDialog()
      })
      if (!ok) return
    } catch (error) {
      console.error('Move failed:', error)
    } finally {
      setMoving(false)
    }
  }

  const renderDir = (dir: Directory, level: number) => {
    const isExpanded = expandedDirs.has(dir.id)
    const children = getChildDirs(dir.id)
    const hasChildren = children.length > 0

    return (
      <React.Fragment key={dir.id}>
        <div
          className={`move-tree-item ${selectedDirId === dir.id ? 'selected' : ''}`}
          style={{ '--indent-level': level } as React.CSSProperties}
          onClick={() => {
            setSelectedDirId(dir.id)
            if (hasChildren) toggleExpand(dir.id)
          }}
        >
          {hasChildren ? (
            <span className={`tree-chevron ${isExpanded ? 'expanded' : ''}`}>
              <ChevronRight size={14} strokeWidth={1.5} />
            </span>
          ) : (
            <span style={{ width: 14 }} />
          )}
          {isExpanded ? <FolderOpen size={16} strokeWidth={1.5} /> : <Folder size={16} strokeWidth={1.5} />}
          <span style={{ fontSize: '13px' }}>{dir.name}</span>
        </div>

        {isExpanded && children.map(child => renderDir(child, level + 1))}
      </React.Fragment>
    )
  }

  if (!moveDialogOpen) return null

  return (
    <div className="dialog-overlay" onClick={closeMoveDialog}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>{t('移动到...')}</h3>
          <button className="icon-btn" onClick={closeMoveDialog}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div style={{ padding: '12px 24px 0', borderBottom: '1px solid var(--border)' }}>
          <div className="search-bar" style={{ padding: 0, border: 'none', marginBottom: 12 }}>
            <div className="search-wrapper">
              <Search size={14} strokeWidth={1.5} className="search-icon" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('搜索目录...')}
              />
            </div>
          </div>
        </div>

        <div className="dialog-body">
          {selectedDirId && (
            <div style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              marginBottom: 12,
              padding: '4px 8px',
              background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-sm)',
            }}>
              {t('选中: {path}', { path: getDirectoryPathString(selectedDirId) })}
            </div>
          )}

          {rootDirs.map(dir => renderDir(dir, 0))}

          {rootDirs.length === 0 && (
            <div className="empty-state">
              <p>{searchQuery ? t('未找到匹配的目录') : t('暂无目录')}</p>
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button className="btn" onClick={closeMoveDialog}>{t('取消')}</button>
          <button
            className="btn btn-primary"
            onClick={handleMove}
            disabled={!selectedDirId || moving}
          >
            {moving ? t('移动中...') : t('确认移动')}
          </button>
        </div>
      </div>
    </div>
  )
}
