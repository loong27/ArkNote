import React, { useMemo, useState } from 'react'
import {
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronsUpDown,
  ChevronsDownUp,
  LayoutGrid,
  LayoutList,
  Download,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { format } from 'date-fns'
import type { Directory } from '../../types'
import { useI18n } from '../../i18n/I18nProvider'

export const DirectoryView: React.FC = () => {
  const { t } = useI18n()
  const {
    selectedDirectoryId,
    directoryViewMode,
    dirById,
    childDirsByParentId,
    notesByDirectoryId,
    getDirectoryPathParts,
    getDirectoryNoteCount,
    setDirectoryViewMode,
    setSelectedDirectoryId,
    setViewMode,
    openNote,
    toggleDir,
    runAfterPendingSave,
  } = useStore()

  const [expandedSubDirs, setExpandedSubDirs] = useState<Set<string>>(new Set())

  // Current directory info
  const currentDir = useMemo(
    () => (selectedDirectoryId ? dirById.get(selectedDirectoryId) : undefined),
    [dirById, selectedDirectoryId]
  )

  const breadcrumb = useMemo(
    () => getDirectoryPathParts(selectedDirectoryId),
    [getDirectoryPathParts, selectedDirectoryId]
  )

  const subDirs = useMemo(
    () => (selectedDirectoryId ? (childDirsByParentId.get(selectedDirectoryId) ?? []) : []),
    [childDirsByParentId, selectedDirectoryId]
  )

  const dirNotes = useMemo(
    () => (selectedDirectoryId ? (notesByDirectoryId.get(selectedDirectoryId) ?? []) : []),
    [notesByDirectoryId, selectedDirectoryId]
  )

  const handleDirClick = async (dir: Directory) => {
    const ok = await runAfterPendingSave(async () => {
      setSelectedDirectoryId(dir.id)
      // Also expand in sidebar
      const expanded = new Set(useStore.getState().expandedDirs)
      expanded.add(dir.id)
      useStore.getState().setExpandedDirs(expanded)
    })
    if (!ok) return
  }

  const handleBreadcrumbClick = async (dirId: string) => {
    const ok = await runAfterPendingSave(async () => {
      setSelectedDirectoryId(dirId)
      setViewMode('directory')
    })
    if (!ok) return
  }

  const toggleExpandSubDir = (dirId: string) => {
    const newSet = new Set(expandedSubDirs)
    if (newSet.has(dirId)) {
      newSet.delete(dirId)
    } else {
      newSet.add(dirId)
    }
    setExpandedSubDirs(newSet)
  }

  const expandAll = () => {
    const allIds = subDirs.map(d => d.id)
    setExpandedSubDirs(new Set(allIds))
  }

  const collapseAll = () => {
    setExpandedSubDirs(new Set())
  }

  if (!selectedDirectoryId || !currentDir) {
    return (
      <div className="welcome-view">
        <h2>{t('选择一个目录')}</h2>
        <p>{t('从左侧目录树中选择一个目录查看其内容')}</p>
      </div>
    )
  }

  return (
    <div className="directory-view">
      {/* Breadcrumb */}
      <div className="directory-view-breadcrumb">
        <span onClick={async () => {
          const ok = await runAfterPendingSave(async () => {
            setSelectedDirectoryId(null)
            setViewMode('welcome')
          })
          if (!ok) return
        }}>
          {t('首页')}
        </span>
        {breadcrumb.map((item, index) => (
          <React.Fragment key={item.id}>
            <span className="separator">/</span>
            <span
              onClick={() => handleBreadcrumbClick(item.id)}
              style={{
                color: index === breadcrumb.length - 1 ? 'var(--text-primary)' : undefined,
                fontWeight: index === breadcrumb.length - 1 ? 600 : undefined,
              }}
            >
              {item.name}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* Header */}
      <div className="directory-view-header">
        <h2>{currentDir.name}</h2>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            className="icon-btn"
            onClick={() => setDirectoryViewMode(directoryViewMode === 'card' ? 'list' : 'card')}
            data-tooltip={directoryViewMode === 'card' ? t('列表视图') : t('卡片视图')}
          >
            {directoryViewMode === 'card' ? <LayoutList size={18} strokeWidth={1.5} /> : <LayoutGrid size={18} strokeWidth={1.5} />}
          </button>
          <button
            className="icon-btn"
            onClick={async () => {
              const result = await window.electronAPI.notes.batchExport(selectedDirectoryId || undefined)
              if (result?.message) alert(t(result.message))
            }}
            data-tooltip={t('批量导出')}
          >
            <Download size={18} strokeWidth={1.5} />
          </button>
          <button className="icon-btn" onClick={expandAll} data-tooltip={t('展开全部')}>
            <ChevronsUpDown size={18} strokeWidth={1.5} />
          </button>
          <button className="icon-btn" onClick={collapseAll} data-tooltip={t('折叠全部')}>
            <ChevronsDownUp size={18} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Sub-directories */}
      {subDirs.length > 0 && (
        <div className={directoryViewMode === 'card' ? 'directory-grid' : 'directory-list'}>
          {subDirs.map(dir => (
            directoryViewMode === 'card' ? (
              <div key={dir.id} className="directory-card" onClick={() => handleDirClick(dir)}>
                <div className="card-icon">
                  <Folder size={24} strokeWidth={1.5} />
                </div>
                <div className="card-info">
                  <div className="card-title">{dir.name}</div>
                  <div className="card-meta">{t('{count} 篇笔记', { count: getDirectoryNoteCount(dir.id) })}</div>
                </div>
              </div>
            ) : (
              <div key={dir.id} className="directory-list-item" onClick={() => handleDirClick(dir)}>
                <Folder size={18} strokeWidth={1.5} />
                <span className="list-item-title">{dir.name}</span>
                <span className="list-item-meta">{t('{count} 篇笔记', { count: getDirectoryNoteCount(dir.id) })}</span>
              </div>
            )
          ))}
        </div>
      )}

      {/* Notes */}
      {dirNotes.length > 0 && (
        <div className="note-list-section">
          <h3>{t('笔记 ({count})', { count: dirNotes.length })}</h3>
          <div className={directoryViewMode === 'card' ? 'directory-grid' : 'directory-list'}>
            {dirNotes.map(note => (
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
        </div>
      )}

      {/* Empty state */}
      {subDirs.length === 0 && dirNotes.length === 0 && (
        <div className="empty-state" style={{ paddingTop: 64 }}>
          <FolderOpen size={48} strokeWidth={1.5} />
          <p>{t('此目录为空')}</p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {t('在左侧目录树中右键可以新建笔记')}
          </p>
        </div>
      )}
    </div>
  )
}
