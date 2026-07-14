import React, { useState, useRef, useEffect } from 'react'
import {
  MoreHorizontal,
  Download,
  FolderInput,
  History,
  FileOutput,
  Tag,
  Trash2,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { ConfirmDialog } from '../Dialogs/ConfirmDialog'

interface Props {
  noteId: string
  htmlContent: string
  trashMode?: boolean
}

export const NoteMenu: React.FC<Props> = ({ noteId, htmlContent, trashMode }) => {
  const [open, setOpen] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const {
    openMoveDialog,
    openTagDialog,
    openVersionDialog,
    setCurrentNote,
    setViewMode,
    loadData,
    currentNote,
    runAfterPendingSave,
  } = useStore()

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const handleDownload = async () => {
    setOpen(false)
    await window.electronAPI.notes.download(noteId)
  }

  const handleExportPdf = async () => {
    setOpen(false)
    await window.electronAPI.notes.exportPdf(noteId, htmlContent)
  }

  const handleMove = () => {
    setOpen(false)
    openMoveDialog(noteId)
  }

  const handleVersions = async () => {
    setOpen(false)
    try {
      const versions = trashMode
        ? await window.electronAPI.trash.listVersions(noteId)
        : await window.electronAPI.versions.list(noteId)
      useStore.getState().setVersions(versions)
      openVersionDialog(noteId)
    } catch (error) {
      console.error('Failed to load versions:', error)
    }
  }

  const handleTags = () => {
    setOpen(false)
    openTagDialog(noteId)
  }

  const handleDelete = () => {
    setOpen(false)
    setShowDeleteConfirm(true)
  }

  const handleConfirmDelete = async () => {
    setShowDeleteConfirm(false)
    try {
      await runAfterPendingSave(async () => {
        await window.electronAPI.notes.delete(noteId)
        setCurrentNote(null)
        setViewMode('welcome')
        await loadData()
      })
    } catch (error) {
      console.error('Failed to delete note:', error)
    }
  }

  return (
    <>
      <div className="note-menu-container" ref={menuRef}>
        <button className="icon-btn" onClick={() => setOpen(!open)} data-tooltip="更多操作">
          <MoreHorizontal size={18} strokeWidth={1.5} />
        </button>

        {open && (
          <div className="note-menu-dropdown">
            {/* In trash mode, only show history versions */}
            {trashMode ? (
              <button className="note-menu-item" onClick={handleVersions}>
                <History size={16} strokeWidth={1.5} />
                <span>历史版本</span>
              </button>
            ) : (
              <>
                <button className="note-menu-item" onClick={handleDownload}>
                  <Download size={16} strokeWidth={1.5} />
                  <span>下载 MD</span>
                </button>
                <button className="note-menu-item" onClick={handleMove}>
                  <FolderInput size={16} strokeWidth={1.5} />
                  <span>移动到...</span>
                </button>
                <button className="note-menu-item" onClick={handleVersions}>
                  <History size={16} strokeWidth={1.5} />
                  <span>历史版本</span>
                </button>
                <button className="note-menu-item" onClick={handleExportPdf}>
                  <FileOutput size={16} strokeWidth={1.5} />
                  <span>导出为 PDF</span>
                </button>
                <button className="note-menu-item" onClick={handleTags}>
                  <Tag size={16} strokeWidth={1.5} />
                  <span>添加标签</span>
                </button>
                <div className="note-menu-separator" />
                <button className="note-menu-item danger" onClick={handleDelete}>
                  <Trash2 size={16} strokeWidth={1.5} />
                  <span>移入回收站</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {!trashMode && (
        <ConfirmDialog
          open={showDeleteConfirm}
          title="移入回收站"
          message={`确定要将笔记「${currentNote?.metadata?.title || ''}」移入回收站吗？`}
          confirmText="确认"
          cancelText="取消"
          danger
          onConfirm={handleConfirmDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  )
}
