import React, { useState, useEffect, useCallback } from 'react'
import { Minus, X, Copy, Square, LockKeyhole, RefreshCw } from 'lucide-react'
import { useStore } from '../store/useStore'
import { DefaultAvatar } from './common/DefaultAvatar'
import { useI18n } from '../i18n/I18nProvider'

/**
 * Apple HIG-inspired custom title bar.
 * - Frameless window with glassmorphism surface
 * - Window controls (minimize, maximize, close) on the RIGHT
 * - Draggable title area
 * - Close dialog: minimize to tray or quit (with remember option)
 */
export const TitleBar: React.FC = () => {
  const { t } = useI18n()
  const [isMaximized, setIsMaximized] = useState(false)
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [rememberChoice, setRememberChoice] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [locking, setLocking] = useState(false)
  const isLocked = useStore((state) => state.isLocked)
  const setLocked = useStore((state) => state.setLocked)
  const setSyncStatus = useStore((state) => state.setSyncStatus)
  const flushPendingSaves = useStore((state) => state.flushPendingSaves)
  const loadData = useStore((state) => state.loadData)
  const refreshCurrentNote = useStore((state) => state.refreshCurrentNote)

  // Listen for maximize/unmaximize events from main process
  useEffect(() => {
    window.electronAPI.window.isMaximized().then(setIsMaximized)

    window.electronAPI.window.onMaximizedChanged((maximized) => {
      setIsMaximized(maximized)
    })

    window.electronAPI.window.onCloseRequested(() => {
      setShowCloseDialog(true)
    })

    window.electronAPI.window.onQuitRequested(() => {
      void (async () => {
        const ok = await flushPendingSaves()
        await window.electronAPI.window.respondToQuitRequest(ok)
      })()
    })

    return () => {
      window.electronAPI.window.removeAllListeners()
    }
  }, [flushPendingSaves])

  const handleMinimize = useCallback(async () => {
    if (!(await flushPendingSaves())) return
    await window.electronAPI.window.minimize()
  }, [flushPendingSaves])

  const handleLock = useCallback(async () => {
    if (locking || syncing || isLocked) return
    setLocking(true)
    try {
      if (!(await flushPendingSaves())) return
      await window.electronAPI.auth.lock()
      setLocked(true)
    } finally {
      setLocking(false)
    }
  }, [flushPendingSaves, isLocked, locking, setLocked, syncing])

  const handleSync = useCallback(async () => {
    if (syncing || locking || isLocked) return
    setSyncing(true)
    try {
      if (!(await flushPendingSaves())) return

      const result = await window.electronAPI.sync.sync()
      setSyncStatus(result)

      if (result.status === 'success') {
        await loadData()
        await refreshCurrentNote()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('Failed to sync:', error)
      const previousStatus = useStore.getState().syncStatus
      setSyncStatus({
        ...previousStatus,
        status: 'error',
        message: `同步失败: ${message}`,
      })
    } finally {
      setSyncing(false)
    }
  }, [flushPendingSaves, isLocked, loadData, locking, refreshCurrentNote, setSyncStatus, syncing])

  const handleMaximize = useCallback(() => {
    window.electronAPI.window.maximize()
  }, [])

  const handleCloseClick = useCallback(async () => {
    const action = await window.electronAPI.window.getCloseAction()
    if (action === 'ask') {
      setShowCloseDialog(true)
    } else {
      if (!(await flushPendingSaves())) return
      await window.electronAPI.window.closeAction(action, false)
    }
  }, [flushPendingSaves])

  const handleCloseDialogAction = useCallback(async (action: 'minimize' | 'quit') => {
    if (!(await flushPendingSaves())) return
    setShowCloseDialog(false)
    await window.electronAPI.window.closeAction(action, rememberChoice)
    setRememberChoice(false)
  }, [flushPendingSaves, rememberChoice])

  const handleCancelClose = useCallback(() => {
    setShowCloseDialog(false)
    setRememberChoice(false)
  }, [])

  return (
    <>
      <div className="title-bar">
        {/* Left: App title (also draggable area) */}
        <div className="title-bar-drag">
          <div className="title-bar-title">
            <DefaultAvatar alt="arkNote" size={18} />
            <span>arkNote</span>
          </div>
        </div>

        {/* Right: Window controls — kept on the right per user request */}
        <div className="title-bar-controls">
          {!isLocked && (
            <>
              <button
                className="title-bar-btn"
                onClick={handleSync}
                disabled={syncing || locking}
                title={syncing ? t('同步中...') : t('立即同步')}
              >
                <RefreshCw size={13} strokeWidth={1.5} className={syncing ? 'spin' : ''} />
              </button>
              <button
                className="title-bar-btn"
                onClick={handleLock}
                disabled={locking || syncing}
                title={t('锁定笔记库')}
              >
                <LockKeyhole size={13} strokeWidth={1.5} />
              </button>
            </>
          )}
          <button
            className="title-bar-btn title-bar-btn-minimize"
            onClick={handleMinimize}
            title={t('最小化')}
          >
            <Minus size={14} strokeWidth={1.5} />
          </button>
          <button
            className="title-bar-btn title-bar-btn-maximize"
            onClick={handleMaximize}
            title={isMaximized ? t('还原') : t('最大化')}
          >
            {isMaximized
              ? <Copy size={11} strokeWidth={1.5} />
              : <Square size={12} strokeWidth={1.6} />
            }
          </button>
          <button
            className="title-bar-btn title-bar-btn-close"
            onClick={handleCloseClick}
            title={t('关闭')}
          >
            <X size={15} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Close confirmation dialog — Apple Sheet style */}
      {showCloseDialog && (
        <div className="dialog-overlay" onClick={handleCancelClose}>
          <div
            className="close-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="close-dialog-header">
              <h3>{t('关闭窗口')}</h3>
            </div>
            <div className="close-dialog-body">
              <p>{t('请选择关闭窗口后的操作：')}</p>
              <div className="close-dialog-actions">
                <button
                  className="close-dialog-btn close-dialog-btn-minimize"
                  onClick={() => handleCloseDialogAction('minimize')}
                >
                  <Minus size={18} strokeWidth={1.5} />
                  <span className="close-dialog-btn-label">{t('最小化到托盘')}</span>
                  <span className="close-dialog-btn-desc">{t('窗口隐藏，后台继续运行')}</span>
                </button>
                <button
                  className="close-dialog-btn close-dialog-btn-quit"
                  onClick={() => handleCloseDialogAction('quit')}
                >
                  <X size={18} strokeWidth={1.5} />
                  <span className="close-dialog-btn-label">{t('退出应用')}</span>
                  <span className="close-dialog-btn-desc">{t('完全关闭应用程序')}</span>
                </button>
              </div>
              <label className="close-dialog-remember">
                <input
                  type="checkbox"
                  checked={rememberChoice}
                  onChange={(e) => setRememberChoice(e.target.checked)}
                />
                <span>{t('记住我的选择（可在设置中重置）')}</span>
              </label>
            </div>
            <div className="close-dialog-footer">
              <button className="btn" onClick={handleCancelClose}>{t('取消')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
