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
    flushPendingSaves,
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
  const [dragItem, setDragItem] = useState<{ type: 'note' | 'dir'; id: string } | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [dropPosition, setDropPosition] = useState<'inside' | 'root' | null>(null)
  const [dropError, setDropError] = useState('')
  const [dragOverRoot, setDragOverRoot] = useState(false)
  const [dropHoverTimer, setDropHoverTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

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

  const handleDragStart = (type: 'note' | 'dir', id: string, e: React.DragEvent) => {
    e.stopPropagation()
    e.dataTransfer.effectAllowed = 'move'
    try {
      e.dataTransfer.setData('text/plain', id)
    } catch {
      // Firefox-style fallback not needed in Electron
    }
    setDragItem({ type, id })
    setDropTarget(null)
    setDropPosition(null)
    setDragOverRoot(false)
    setDropError('')
  }

  const handleDragEnd = () => {
    setDragItem(null)
    setDropTarget(null)
    setDropPosition(null)
    setDragOverRoot(false)
    setDropError('')
    if (dropHoverTimer) clearTimeout(dropHoverTimer)
  }

  // Auto-expand a folder while hovering over it during drag
  const scheduleDirExpand = (dirId: string) => {
    if (dropHoverTimer) clearTimeout(dropHoverTimer)
    const timer = setTimeout(() => {
      if (dragItem) {
        const expanded = new Set(useStore.getState().expandedDirs)
        expanded.add(dirId)
        useStore.getState().setExpandedDirs(expanded)
      }
    }, 700)
    setDropHoverTimer(timer)
  }

  const clearDropHoverTimer = () => {
    if (dropHoverTimer) {
      clearTimeout(dropHoverTimer)
      setDropHoverTimer(null)
    }
  }

  const isDirDescendantOf = (dirId: string, ancestorId: string): boolean => {
    let current = dirById.get(dirId)?.parentId ?? null
    while (current) {
      if (current === ancestorId) return true
      current = dirById.get(current)?.parentId ?? null
    }
    return false
  }

  const getDropHint = () => {
    if (!dragItem) return ''
    const label = dragItem.type === 'note'
      ? (notes.find(n => n.id === dragItem.id)?.title ?? '')
      : (dirById.get(dragItem.id)?.name ?? '')
    return t('将「{name}」移动到目标文件夹', { name: label })
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

  const handleDropMove = async (targetDirId: string | null) => {
    if (!dragItem) return
    const source = dragItem
    const finalTarget = targetDirId

    // Notes cannot live at root (no root note container exists), only inside a folder
    if (source.type === 'note' && targetDirId === null) {
      setDropError(t('请将笔记拖入具体文件夹'))
      setDropTarget(null)
      setDropPosition('root')
      return
    }

    let error: unknown = null
    if (!(await flushPendingSaves())) {
      setDropError(t('等待保存完成后重试'))
      return
    }

    try {
      if (source.type === 'note') {
        await window.electronAPI.notes.move(source.id, targetDirId ?? '')
      } else {
        await window.electronAPI.directories.move(source.id, targetDirId)
      }
    } catch (err) {
      error = err
    }

    if (error) {
      setDropError(error instanceof Error ? error.message : t('移动失败'))
      setDropTarget(finalTarget)
      setDropPosition(finalTarget === null ? 'root' : 'inside')
      return
    }

    await loadData()
    setDropError('')
    setDragItem(null)
    setDropTarget(null)
    setDropPosition(null)
    setDragOverRoot(false)
    if (dropHoverTimer) clearTimeout(dropHoverTimer)
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
          className={`tree-item ${isActive ? 'active' : ''} ${dropTarget === dir.id ? `drop-${dropPosition}` : ''}`}
          style={{ '--indent-level': level } as React.CSSProperties}
          onClick={() => handleDirClick(dir)}
          draggable
          onDragStart={(e) => handleDragStart('dir', dir.id, e)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => {
            e.preventDefault()
            e.stopPropagation()
            e.dataTransfer.dropEffect = 'move'
            if (!dragItem || dragItem.id === dir.id) return
            if (dropTarget !== dir.id || dropPosition !== 'inside') {
              setDropTarget(dir.id)
              setDropPosition('inside')
              if (!expandedDirs.has(dir.id)) {
                scheduleDirExpand(dir.id)
              } else {
                clearDropHoverTimer()
              }
            }
          }}
          onDragLeave={(e) => {
            e.stopPropagation()
            if (e.currentTarget.contains(e.relatedTarget as Node)) return
            setDropTarget(null)
            setDropPosition(null)
            clearDropHoverTimer()
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (!dragItem || dragItem.id === dir.id) return
            if (dragItem.type === 'dir' && dir.id === dragItem.id) return
            if (dragItem.type === 'dir' && isDirDescendantOf(dir.id, dragItem.id)) {
              setDropError(t('不能将目录移动到其子目录中'))
              return
            }
            setDropTarget(dir.id)
            setDropPosition('inside')
            handleDropMove(dir.id)
          }}
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
                className={`tree-item ${currentNote?.id === note.id ? 'active' : ''} ${dragItem?.type === 'note' && dragItem.id === note.id ? 'dragging' : ''}`}
                style={{ '--indent-level': level + 1 } as React.CSSProperties}
                onClick={() => handleNoteClick(note)}
                draggable
                onDragStart={(e) => handleDragStart('note', note.id, e)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  e.dataTransfer.dropEffect = 'move'
                  if (dragItem) {
                    setDropTarget(dir.id)
                    setDropPosition('inside')
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (!dragItem) return
                  setDropTarget(dir.id)
                  setDropPosition('inside')
                  handleDropMove(dir.id)
                }}
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

      <div
        className={`sidebar-content ${dragItem && dropPosition === 'root' ? 'drop-root' : ''} ${dragOverRoot ? 'drag-over-root' : ''}`}
        onClick={() => {
          if (!dragItem) return
          setDragOverRoot(false)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (!dragItem) return
          if (dragItem.type === 'note') {
            e.dataTransfer.dropEffect = 'none'
            setDropError(t('请将笔记拖入具体文件夹'))
            setDropTarget(null)
            setDropPosition(null)
            return
          }
          e.dataTransfer.dropEffect = 'move'
          setDragOverRoot(true)
          setDropError('')
          clearDropHoverTimer()
        }}
        onDragLeave={(e) => {
          e.stopPropagation()
          if (e.currentTarget.contains(e.relatedTarget as Node)) return
          setDragOverRoot(false)
          setDropTarget(null)
          setDropPosition(null)
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (!dragItem) return
          if (dragItem.type === 'note') {
            setDropError(t('请将笔记拖入具体文件夹'))
            setDropTarget(null)
            setDropPosition(null)
            return
          }
          setDragOverRoot(false)
          setDropTarget(null)
          setDropPosition('root')
          handleDropMove(null)
        }}
      >
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

        {rootDirs.length === 0 && !creatingIn && !dragItem && (
          <div className="empty-state">
            <Folder size={32} strokeWidth={1.5} />
            <p>{searchQuery ? t('未找到匹配的目录或笔记') : t('暂无目录，点击上方新增创建')}</p>
          </div>
        )}

        {dragItem && (
          <div className={`tree-drop-hint ${dropPosition === 'root' ? 'root' : ''}`}>
            <span>{getDropHint()}</span>
            {dropError && <em className="tree-drop-error">{dropError}</em>}
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




















