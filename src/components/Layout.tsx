import React, { useState, useCallback, useRef, useEffect } from 'react'
import { BookOpen } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Sidebar } from './Sidebar/Sidebar'
import { NoteView } from './NoteView/NoteView'
import { DirectoryView } from './NoteView/DirectoryView'
import { TagNoteView } from './NoteView/TagNoteView'
import { NoteTabs } from './NoteTabs'
import { MoveDialog } from './Dialogs/MoveDialog'
import { TagDialog } from './Dialogs/TagDialog'
import { VersionDialog } from './Dialogs/VersionDialog'
import { SettingsDialog } from './Dialogs/SettingsDialog'

export const Layout: React.FC = () => {
  const {
    viewMode,
    sidebarWidth,
    setSidebarWidth,
    settingsDialogOpen,
    closeSettingsDialog,
  } = useStore()
  const [isResizing, setIsResizing] = useState(false)
  const layoutRef = useRef<HTMLDivElement>(null)
  const sidebarWidthRef = useRef(sidebarWidth)

  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth
  }, [sidebarWidth])

  useEffect(() => {
    let cancelled = false
    window.electronAPI.config.getSidebarWidth()
      .then((width) => {
        if (!cancelled) setSidebarWidth(width)
      })
      .catch(console.error)
    return () => {
      cancelled = true
    }
  }, [setSidebarWidth])

  // Handle sidebar resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !layoutRef.current) return

      const layoutRect = layoutRef.current.getBoundingClientRect()
      const newWidth = ((e.clientX - layoutRect.left) / layoutRect.width) * 100

      // Clamp between 10% and 40%
      const clampedWidth = Math.min(40, Math.max(10, newWidth))
      setSidebarWidth(clampedWidth)
    },
    [isResizing, setSidebarWidth]
  )

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
    window.electronAPI.config.setSidebarWidth(sidebarWidthRef.current).catch(console.error)
  }, [])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S: manual save
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        const { currentNote, saveManualVersion } = useStore.getState()
        if (currentNote) {
          void saveManualVersion()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <>
      <div className="app-layout" ref={layoutRef}>
        {/* Sidebar */}
        <div style={{ flex: `0 0 ${sidebarWidth}%`, minWidth: 0, position: 'relative' }}>
          <Sidebar />
        </div>

        {/* Resize handle */}
        <div
          className={`resize-handle ${isResizing ? 'active' : ''}`}
          onMouseDown={handleMouseDown}
        />

        {/* Main content */}
        <div className="main-content">
          <NoteTabs />

          {viewMode === 'welcome' && (
            <div className="welcome-view">
              <BookOpen size={64} strokeWidth={1.5} color="var(--accent)" />
              <h2><span>ZZ</span>-Note</h2>
              <p>安全、加密的跨平台笔记应用</p>
              <div className="shortcuts">
                <div className="shortcut">
                  <kbd>Ctrl + S</kbd>
                  <span>保存版本</span>
                </div>
                <div className="shortcut">
                  <kbd>Ctrl + F</kbd>
                  <span>笔记内搜索</span>
                </div>
                <div className="shortcut">
                  <kbd>Ctrl + V</kbd>
                  <span>粘贴图片</span>
                </div>
              </div>
            </div>
          )}

          {viewMode === 'directory' && <DirectoryView />}

          {viewMode === 'tag' && <TagNoteView />}

          {viewMode === 'note' && <NoteView />}
        </div>
      </div>

      {/* Dialogs */}
      <MoveDialog />
      <TagDialog />
      <VersionDialog />
      <SettingsDialog open={settingsDialogOpen} onClose={closeSettingsDialog} />
    </>
  )
}
