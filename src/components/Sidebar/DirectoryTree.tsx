import React, { useState, useMemo, useCallback, useEffect } from 'react'
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FileText,
  Plus,
  FolderPlus,
  Trash2,
  Edit3,
  Upload,
  FileUp,
  MoreHorizontal,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { SearchBar } from './SearchBar'
import { ConfirmDialog } from '../Dialogs/ConfirmDialog'
import type { Directory, NoteMetadata } from '../../types'
import { useI18n } from '../../i18n/I18nProvider'

const leadingTitleRegex = /^(\s*)#\s+[^\n#].*?(?:\s+#*)?\s*(\r?\n|$)/

function setLeadingMarkdownTitle(markdown: string, noteTitle: string, untitled: string): string {
  const titleLine = `# ${noteTitle.trim() || untitled}`
  if (leadingTitleRegex.test(markdown)) {
    return markdown.replace(leadingTitleRegex, (_match, leading, lineEnd) => `${leading}${titleLine}${lineEnd}`)
  }
  return `${titleLine}\n\n${markdown}`
}

export const DirectoryTree: React.FC = () => {
  const { t } = useI18n()
  const {
    directories,
    notes,
    expandedDirs,
    selectedDirectoryId,
    currentNote,
    childDirsByParentId,
    notesByDirectoryId,
    dirById,
    toggleDir,
    setSelectedDirectoryId,
    setViewMode,
    openNote,
    loadData,
    runAfterPendingSave,
  } = useStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [creatingIn, setCreatingIn] = useState<{ parentId: string | null; type: 'dir' | 'note' } | null>(null)
  const [createValue, setCreateValue] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string
    type: 'dir' | 'note'
    name: string
  } | null>(null)
  const [openDirMenuId, setOpenDirMenuId] = useState<string | null>(null)
  const [dirMenuPosition, setDirMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false)

  // Filter directories and notes by search query
  const { filteredDirs, filteredNotes } = useMemo(() => {
    if (!searchQuery) return { filteredDirs: directories, filteredNotes: notes }
    const query = searchQuery.toLowerCase()

    const getAncestorIds = (dirId: string | null): Set<string> => {
      const ids = new Set<string>()
      let currentId = dirId
      while (currentId) {
        ids.add(currentId)
        const dir = dirById.get(currentId)
        if (!dir) break
        currentId = dir.parentId
      }
      return ids
    }

    const getDescendantDirIds = (parentId: string): Set<string> => {
      const ids = new Set<string>()
      const children = childDirsByParentId.get(parentId) ?? []
      for (const child of children) {
        ids.add(child.id)
        const childDescendants = getDescendantDirIds(child.id)
        childDescendants.forEach(id => ids.add(id))
      }
      return ids
    }

    const matchedDirIds = new Set<string>()
    const matchedNoteIds = new Set<string>()

    for (const dir of directories) {
      if (dir.name.toLowerCase().includes(query)) {
        matchedDirIds.add(dir.id)
        getAncestorIds(dir.parentId).forEach(id => matchedDirIds.add(id))
        getDescendantDirIds(dir.id).forEach(id => matchedDirIds.add(id))
      }
    }

    for (const note of notes) {
      if (note.title.toLowerCase().includes(query)) {
        matchedNoteIds.add(note.id)
        getAncestorIds(note.directoryId).forEach(id => matchedDirIds.add(id))
      }
    }

    return {
      filteredDirs: directories.filter(d => matchedDirIds.has(d.id)),
      filteredNotes: notes.filter(n => matchedNoteIds.has(n.id)),
    }
  }, [directories, notes, searchQuery, dirById, childDirsByParentId])

  // Auto-expand all filtered directories when searching
  useEffect(() => {
    if (searchQuery && filteredDirs.length > 0) {
      const newExpanded = new Set(useStore.getState().expandedDirs)
      filteredDirs.forEach(d => newExpanded.add(d.id))
      useStore.getState().setExpandedDirs(newExpanded)
    }
  }, [searchQuery, filteredDirs])

  useEffect(() => {
    if (!openDirMenuId && !isCreateMenuOpen) return

    const closeMenu = () => {
      setOpenDirMenuId(null)
      setDirMenuPosition(null)
      setIsCreateMenuOpen(false)
    }
    document.addEventListener('click', closeMenu)
    return () => document.removeEventListener('click', closeMenu)
  }, [openDirMenuId, isCreateMenuOpen])

  const rootDirs = useMemo(
    () => filteredDirs.filter(d => d.parentId === null).sort((a, b) => a.order - b.order),
    [filteredDirs]
  )

  const getChildDirs = useCallback(
    (parentId: string) => (childDirsByParentId.get(parentId) ?? []).filter(d => filteredDirs.includes(d)),
    [childDirsByParentId, filteredDirs]
  )

  const getChildNotes = useCallback(
    (directoryId: string) => (notesByDirectoryId.get(directoryId) ?? []).filter(n => filteredNotes.includes(n)),
    [notesByDirectoryId, filteredNotes]
  )

  const getDirLevel = useCallback(
    (dirId: string): number => {
      let level = 0
      let currentId: string | null = dirId
      while (currentId) {
        const dir = dirById.get(currentId)
        if (!dir || !dir.parentId) break
        level++
        currentId = dir.parentId
      }
      return level
    },
    [dirById]
  )

  const handleDirClick = async (dir: Directory) => {
    const ok = await runAfterPendingSave(async () => {
      setSelectedDirectoryId(dir.id) // store also clears currentNote
      setViewMode('directory')
      toggleDir(dir.id)
    })
    if (!ok) return
  }

  const handleNoteClick = (note: NoteMetadata) => {
    openNote(note.id)
  }

  const handleCreateDir = async (parentId: string | null) => {
    setCreatingIn({ parentId, type: 'dir' })
    setCreateValue('')
    if (parentId) {
      const expanded = new Set(useStore.getState().expandedDirs)
      expanded.add(parentId)
      useStore.getState().setExpandedDirs(expanded)
    }
  }

  const handleCreateNote = async (directoryId: string) => {
    setCreatingIn({ parentId: directoryId, type: 'note' })
    setCreateValue('')
    const expanded = new Set(useStore.getState().expandedDirs)
    expanded.add(directoryId)
    useStore.getState().setExpandedDirs(expanded)
  }

  const handleConfirmCreate = async () => {
    if (!creatingIn || !createValue.trim()) {
      setCreatingIn(null)
      return
    }

    try {
      if (creatingIn.type === 'dir') {
        await window.electronAPI.directories.create(creatingIn.parentId, createValue.trim())
      } else {
        if (creatingIn.parentId) {
          const note = await window.electronAPI.notes.create(creatingIn.parentId, createValue.trim())
          openNote(note.id)
        }
      }
      await loadData()
    } catch (error) {
      console.error('Create failed:', error)
    }

    setCreatingIn(null)
    setCreateValue('')
  }

  const handleStartRename = (id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(id)
    setEditValue(currentName)
  }

  const handleConfirmRename = async (id: string, type: 'dir' | 'note') => {
    if (!editValue.trim()) {
      setEditingId(null)
      return
    }

    try {
      const nextTitle = editValue.trim()
      if (type === 'dir') {
        await window.electronAPI.directories.rename(id, nextTitle)
      } else {
        const ok = await runAfterPendingSave(async () => {
          await window.electronAPI.notes.updateTitle(id, nextTitle)
          const noteContent = await window.electronAPI.notes.get(id)
          const nextContent = setLeadingMarkdownTitle(noteContent.content, nextTitle, t('无标题'))
          if (nextContent !== noteContent.content) {
            await window.electronAPI.notes.update(id, nextContent)
          }
        })
        if (!ok) return
      }
      await loadData()
    } catch (error) {
      console.error('Rename failed:', error)
    }

    setEditingId(null)
  }

  // Handle delete → move to trash (soft delete)
  const handleDelete = (id: string, type: 'dir' | 'note', name: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeleteConfirm({ id, type, name })
  }

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return

    try {
      const ok = await runAfterPendingSave(async () => {
        if (deleteConfirm.type === 'dir') {
          await window.electronAPI.directories.delete(deleteConfirm.id)
        } else {
          await window.electronAPI.notes.delete(deleteConfirm.id)
          if (currentNote?.id === deleteConfirm.id) {
            useStore.getState().setCurrentNote(null)
            useStore.getState().setViewMode('welcome')
          }
        }
        await loadData()
      })
      if (!ok) return
    } catch (error) {
      console.error('Delete failed:', error)
    }

    setDeleteConfirm(null)
  }

  // Import handlers
  const handleImportMd = async (directoryId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const result = await window.electronAPI.import.importMd(directoryId)
      if (result.success && result.noteId) {
        await loadData()
        openNote(result.noteId)
      }
    } catch (error) {
      console.error('Import MD failed:', error)
    }
  }

  const handleImportPdf = async (directoryId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const result = await window.electronAPI.import.importPdf(directoryId)
      if (result.success && result.noteId) {
        await loadData()
        openNote(result.noteId)
      }
    } catch (error) {
      console.error('Import PDF failed:', error)
    }
  }

  const renderDir = (dir: Directory, level: number) => {
    const isExpanded = expandedDirs.has(dir.id)
    const isActive = selectedDirectoryId === dir.id
    const childDirs = getChildDirs(dir.id)
    const childNotes = getChildNotes(dir.id)
    const canCreateSubDir = level < 2

    return (
      <React.Fragment key={dir.id}>
        <div
          className={`tree-item ${isActive ? 'active' : ''}`}
          style={{ '--indent-level': level } as React.CSSProperties}
          onClick={() => handleDirClick(dir)}
        >
          <span className={`tree-chevron ${isExpanded ? 'expanded' : ''}`}>
            <ChevronRight size={14} strokeWidth={1.5} />
          </span>
          <span className="tree-icon">
            {isExpanded ? <FolderOpen size={16} strokeWidth={1.5} /> : <Folder size={16} strokeWidth={1.5} />}
          </span>

          {editingId === dir.id ? (
            <input
              className="context-input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => handleConfirmRename(dir.id, 'dir')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmRename(dir.id, 'dir')
                if (e.key === 'Escape') setEditingId(null)
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <span className="tree-label">{dir.name}</span>
          )}

          <div className="tree-actions">
            {canCreateSubDir && (
              <button
                className="icon-btn sm"
                onClick={(e) => { e.stopPropagation(); handleCreateDir(dir.id) }}
                data-tooltip={t('新建子目录')}
              >
                <FolderPlus size={14} strokeWidth={1.5} />
              </button>
            )}
            <button
              className="icon-btn sm"
              onClick={(e) => { e.stopPropagation(); handleCreateNote(dir.id) }}
              data-tooltip={t('新建笔记')}
            >
              <Plus size={14} strokeWidth={1.5} />
            </button>
            <div
              className="note-menu-container tree-overflow-menu"
              onMouseLeave={() => {
                if (openDirMenuId === dir.id) {
                  setOpenDirMenuId(null)
                  setDirMenuPosition(null)
                }
              }}
            >
              <button
                className="icon-btn sm"
                onClick={(e) => {
                  e.stopPropagation()
                  const rect = e.currentTarget.getBoundingClientRect()
                  const menuHeight = 136
                  const menuWidth = 180
                  const openUpward = window.innerHeight - rect.bottom < menuHeight + 8
                  setDirMenuPosition({
                    top: openUpward ? rect.top - menuHeight - 4 : rect.bottom + 4,
                    left: Math.min(rect.left, window.innerWidth - menuWidth - 8),
                  })
                  setOpenDirMenuId(openDirMenuId === dir.id ? null : dir.id)
                }}
                data-tooltip={t('更多')}
              >
                <MoreHorizontal size={14} strokeWidth={1.5} />
              </button>
              {openDirMenuId === dir.id && dirMenuPosition && (
                <div
                  className="note-menu-dropdown tree-menu-dropdown"
                  style={{ top: dirMenuPosition.top, left: dirMenuPosition.left } as React.CSSProperties}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="note-menu-item"
                    onClick={(e) => {
                      setOpenDirMenuId(null)
                      setDirMenuPosition(null)
                      handleStartRename(dir.id, dir.name, e)
                    }}
                  >
                    <Edit3 size={14} strokeWidth={1.5} />
                    {t('重命名')}
                  </button>
                  <button
                    className="note-menu-item"
                    onClick={(e) => {
                      setOpenDirMenuId(null)
                      setDirMenuPosition(null)
                      handleImportMd(dir.id, e)
                    }}
                  >
                    <Upload size={14} strokeWidth={1.5} />
                    {t('导入 MD')}
                  </button>
                  <button
                    className="note-menu-item"
                    onClick={(e) => {
                      setOpenDirMenuId(null)
                      setDirMenuPosition(null)
                      handleImportPdf(dir.id, e)
                    }}
                  >
                    <FileUp size={14} strokeWidth={1.5} />
                    {t('导入 PDF')}
                  </button>
                  <div className="note-menu-separator" />
                  <button
                    className="note-menu-item danger"
                    onClick={(e) => {
                      setOpenDirMenuId(null)
                      setDirMenuPosition(null)
                      handleDelete(dir.id, 'dir', dir.name, e)
                    }}
                  >
                    <Trash2 size={14} strokeWidth={1.5} />
                    {t('删除')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {isExpanded && (
          <>
            {creatingIn && creatingIn.parentId === dir.id && (
              <div
                className="tree-item"
                style={{ '--indent-level': level + 1 } as React.CSSProperties}
              >
                <span className="tree-icon">
                  {creatingIn.type === 'dir' ? <Folder size={16} strokeWidth={1.5} /> : <FileText size={16} strokeWidth={1.5} />}
                </span>
                <input
                  className="context-input"
                  placeholder={creatingIn.type === 'dir' ? t('新目录名称') : t('新笔记标题')}
                  value={createValue}
                  onChange={(e) => setCreateValue(e.target.value)}
                  onBlur={handleConfirmCreate}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmCreate()
                    if (e.key === 'Escape') setCreatingIn(null)
                  }}
                  autoFocus
                />
              </div>
            )}

            {childDirs.map(child => renderDir(child, level + 1))}

            {childNotes.map(note => (
              <div
                key={note.id}
                className={`tree-item ${currentNote?.id === note.id ? 'active' : ''}`}
                style={{ '--indent-level': level + 1 } as React.CSSProperties}
                onClick={() => handleNoteClick(note)}
              >
                <span className="tree-chevron" style={{ visibility: 'hidden' }}>
                  <ChevronRight size={14} strokeWidth={1.5} />
                </span>
                <span className="tree-icon">
                  <FileText size={16} strokeWidth={1.5} />
                </span>

                {editingId === note.id ? (
                  <input
                    className="context-input"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleConfirmRename(note.id, 'note')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleConfirmRename(note.id, 'note')
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                  />
                ) : (
                  <span className="tree-label">{note.title}</span>
                )}

                <div className="tree-actions">
                  <button
                    className="icon-btn sm"
                    onClick={(e) => handleStartRename(note.id, note.title, e)}
                  >
                    <Edit3 size={14} strokeWidth={1.5} />
                  </button>
                  <button
                    className="icon-btn sm"
                    onClick={(e) => handleDelete(note.id, 'note', note.title, e)}
                  >
                    <Trash2 size={14} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </React.Fragment>
    )
  }

  return (
    <>
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={t('搜索目录和笔记...')}
      />

      <div className="sidebar-create-row">
        <div className="sidebar-create-menu">
          <button
            className="sidebar-create-btn"
            onClick={(e) => {
              e.stopPropagation()
              setIsCreateMenuOpen(!isCreateMenuOpen)
            }}
          >
            <Plus size={17} strokeWidth={2} />
            {t('新增')}
          </button>
          {isCreateMenuOpen && (
            <div className="sidebar-create-dropdown" onClick={(e) => e.stopPropagation()}>
              <button
                className="note-menu-item"
                onClick={() => {
                  setIsCreateMenuOpen(false)
                  handleCreateDir(null)
                }}
              >
                <FolderPlus size={14} strokeWidth={1.5} />
                {t('新增目录')}
              </button>
              <button
                className="note-menu-item"
                onClick={() => {
                  setIsCreateMenuOpen(false)
                  setCreatingIn({ parentId: null, type: 'note' })
                  setCreateValue('')
                }}
              >
                <FileText size={14} strokeWidth={1.5} />
                {t('新增笔记')}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="sidebar-content">
        {creatingIn && creatingIn.parentId === null && (
          <div className="tree-item" style={{ '--indent-level': 0 } as React.CSSProperties}>
            <span className="tree-icon">
              {creatingIn.type === 'dir'
                ? <Folder size={16} strokeWidth={1.5} />
                : <FileText size={16} strokeWidth={1.5} />}
            </span>
            <input
              className="context-input"
              placeholder={creatingIn.type === 'dir' ? t('新目录名称') : t('新笔记名称')}
              value={createValue}
              onChange={(e) => setCreateValue(e.target.value)}
              onBlur={handleConfirmCreate}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmCreate()
                if (e.key === 'Escape') setCreatingIn(null)
              }}
              autoFocus
            />
          </div>
        )}

        {rootDirs.map(dir => renderDir(dir, 0))}

        {rootDirs.length === 0 && !creatingIn && (
          <div className="empty-state">
            <Folder size={32} strokeWidth={1.5} />
            <p>{searchQuery ? t('未找到匹配的目录或笔记') : t('暂无目录，点击上方新增创建')}</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirm !== null}
        title={t('移入回收站')}
        message={
          deleteConfirm?.type === 'dir'
            ? t('确定要将目录「{name}」及其所有内容移入回收站吗？', { name: deleteConfirm?.name || '' })
            : t('确定要将笔记「{name}」移入回收站吗？', { name: deleteConfirm?.name || '' })
        }
        confirmText={t('确认')}
        cancelText={t('取消')}
        danger
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </>
  )
}
