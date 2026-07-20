import React, { useState, useCallback, useRef, useEffect } from 'react'
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
import type { SecurityConfig } from '../types'
import { DefaultAvatar } from './common/DefaultAvatar'
import { useI18n } from '../i18n/I18nProvider'

export const Layout: React.FC = () => {
  const { t } = useI18n()
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
  const idleTimerRef = useRef<number | null>(null)
  const lastActivityRef = useRef(Date.now())
  const securityConfigRef = useRef<SecurityConfig>({ autoLockMinutes: 15, lockOnMinimize: true })
  const lockingRef = useRef(false)

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

  useEffect(() => {
    window.electronAPI.sync.onAutoSyncRequested(() => {
      void (async () => {
        const ok = await useStore.getState().flushPendingSaves()
        await window.electronAPI.sync.respondToAutoSyncRequest(ok)
      })()
    })

    window.electronAPI.sync.onDataChanged(() => {
      void (async () => {
        const { loadData, refreshCurrentNote } = useStore.getState()
        await loadData()
        await refreshCurrentNote()
      })()
    })

    return () => {
      window.electronAPI.sync.removeAllListeners()
    }
  }, [])

  useEffect(() => {
    let disposed = false

    const clearIdleTimer = () => {
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current)
        idleTimerRef.current = null
      }
    }

    const lockVault = async () => {
      if (lockingRef.current || useStore.getState().isLocked) return
      lockingRef.current = true
      clearIdleTimer()

      try {
        const { flushPendingSaves, setLocked } = useStore.getState()
        if (!(await flushPendingSaves())) {
          lastActivityRef.current = Date.now()
          scheduleIdleLock()
          return
        }

        await window.electronAPI.auth.lock()
        setLocked(true)
      } catch (error) {
        console.error('Failed to lock vault:', error)
        lastActivityRef.current = Date.now()
        scheduleIdleLock()
      } finally {
        lockingRef.current = false
      }
    }

    const scheduleIdleLock = () => {
      clearIdleTimer()
      const minutes = securityConfigRef.current.autoLockMinutes
      if (disposed || minutes <= 0 || useStore.getState().isLocked) return

      const timeoutMs = minutes * 60 * 1000
      const elapsedMs = Date.now() - lastActivityRef.current
      idleTimerRef.current = window.setTimeout(() => {
        void lockVault()
      }, Math.max(0, timeoutMs - elapsedMs))
    }

    const recordActivity = () => {
      const now = Date.now()
      if (now - lastActivityRef.current < 1000) return
      lastActivityRef.current = now
      scheduleIdleLock()
    }

    const applySecurityConfig = (config: SecurityConfig) => {
      securityConfigRef.current = config
      lastActivityRef.current = Date.now()
      scheduleIdleLock()
    }

    const handleSecurityConfigChanged = (event: Event) => {
      applySecurityConfig((event as CustomEvent<SecurityConfig>).detail)
    }

    window.electronAPI.auth.onLocked(() => {
      clearIdleTimer()
      useStore.getState().setLocked(true)
    })

    window.electronAPI.config.getSecurity()
      .then((config) => {
        if (!disposed) applySecurityConfig(config)
      })
      .catch((error) => console.error('Failed to load security config:', error))

    const activityEvents: Array<keyof WindowEventMap> = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart']
    for (const eventName of activityEvents) {
      window.addEventListener(eventName, recordActivity, { passive: true })
    }
    window.addEventListener('arknote:security-config-changed', handleSecurityConfigChanged)

    return () => {
      disposed = true
      clearIdleTimer()
      window.electronAPI.auth.removeAllListeners()
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, recordActivity)
      }
      window.removeEventListener('arknote:security-config-changed', handleSecurityConfigChanged)
    }
  }, [])

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
              <DefaultAvatar alt="arkNote" size={64} />
              <h2>arkNote</h2>
              <p>{t('安全、加密的跨平台笔记应用')}</p>
              <div className="shortcuts">
                <div className="shortcut">
                  <kbd>Ctrl + S</kbd>
                  <span>{t('保存版本')}</span>
                </div>
                <div className="shortcut">
                  <kbd>Ctrl + F</kbd>
                  <span>{t('笔记内搜索')}</span>
                </div>
                <div className="shortcut">
                  <kbd>Ctrl + V</kbd>
                  <span>{t('粘贴图片')}</span>
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
