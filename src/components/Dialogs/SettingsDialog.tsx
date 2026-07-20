import React, { useState, useEffect } from 'react'
import { X, FolderOpen, Key, HardDrive, AlertTriangle, RefreshCw, Monitor, GitBranch, Cloud, CheckCircle, XCircle, LockKeyhole, Clock3, Download, PackageCheck, RotateCcw } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { AppUpdateState, SyncConfig, SyncStatus, SyncConflict } from '../../types'
import { useI18n } from '../../i18n/I18nProvider'

/* Apple HIG icon stroke width constant (matches SF Symbols) */
const SW = 1.5

interface Props {
  open: boolean
  onClose: () => void
}

export const SettingsDialog: React.FC<Props> = ({ open, onClose }) => {
  const { language, locale, setLanguage, t } = useI18n()
  const { runAfterPendingSave, loadData, refreshCurrentNote, theme, setTheme } = useStore()

  // Data directory state
  const [dataDir, setDataDir] = useState('')
  const [defaultDataDir, setDefaultDataDir] = useState('')
  const [configPath, setConfigPath] = useState('')
  const [dirMessage, setDirMessage] = useState<{ type: 'success' | 'error' | ''; text: string }>({ type: '', text: '' })
  const [dirInspectMessage, setDirInspectMessage] = useState('')
  const [dirChanging, setDirChanging] = useState(false)

  // Password change state
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [pwdMessage, setPwdMessage] = useState<{ type: 'success' | 'error' | ''; text: string }>({ type: '', text: '' })
  const [pwdChanging, setPwdChanging] = useState(false)
  const [pwdRetryUntil, setPwdRetryUntil] = useState(0)
  const [pwdNow, setPwdNow] = useState(Date.now())
  const [autoLockMinutes, setAutoLockMinutes] = useState(15)
  const [lockOnMinimize, setLockOnMinimize] = useState(true)
  const [securitySaving, setSecuritySaving] = useState(false)
  const [securityMessage, setSecurityMessage] = useState<{ type: 'success' | 'error' | ''; text: string }>({ type: '', text: '' })

  // Close behavior state
  const [closeAction, setCloseAction] = useState<'ask' | 'minimize' | 'quit'>('ask')
  const [updateState, setUpdateState] = useState<AppUpdateState>({
    phase: 'idle',
    currentVersion: '',
    availableVersion: null,
    progress: null,
    message: '尚未检查更新',
    checkedAt: null,
  })

  // Sync state
  const [syncConfig, setSyncConfig] = useState<SyncConfig>({
    enabled: false,
    provider: 'git',
    repoUrl: '',
    branch: 'main',
    ossEndpoint: '',
    ossBucket: '',
    ossAccessKey: '',
    ossSecretKey: '',
    ossRegion: '',
    autoSync: false,
    syncInterval: 30,
  })
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ lastSync: null, status: 'idle', message: '' })
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error' | ''; text: string }>({ type: '', text: '' })
  const [syncing, setSyncing] = useState(false)
  const [conflicts, setConflicts] = useState<SyncConflict[]>([])

  // Active tab
  const [activeTab, setActiveTab] = useState<'storage' | 'password' | 'general' | 'sync'>('general')

  // Load config on open
  useEffect(() => {
    if (!open) return
    const loadConfig = async () => {
      try {
        const [config, action, sConfig, sStatus, authStatus, appUpdate] = await Promise.all([
          window.electronAPI.config.getAll(),
          window.electronAPI.window.getCloseAction(),
          window.electronAPI.sync.getConfig(),
          window.electronAPI.sync.getStatus(),
          window.electronAPI.auth.getUnlockStatus(),
          window.electronAPI.updates.getState(),
        ])
        setDataDir(config.dataDir)
        setDefaultDataDir(config.defaultDataDir)
        setConfigPath(config.configPath)
        setDirInspectMessage('')
        setCloseAction(action)
        setAutoLockMinutes(config.autoLockMinutes)
        setLockOnMinimize(config.lockOnMinimize)
        const currentTime = Date.now()
        setPwdNow(currentTime)
        setPwdRetryUntil(currentTime + authStatus.retryAfterMs)
        setSyncConfig(sConfig)
        setSyncStatus(sStatus)
        setUpdateState(appUpdate)
        if (sStatus.conflicts && sStatus.conflicts.length > 0) {
          setConflicts(sStatus.conflicts)
        }
      } catch (error) {
        console.error('Failed to load config:', error)
      }
    }
    loadConfig()
  }, [open])

  useEffect(() => {
    return window.electronAPI.updates.onStateChanged(setUpdateState)
  }, [])

  useEffect(() => {
    if (pwdRetryUntil <= Date.now()) return
    const timer = window.setInterval(() => {
      const currentTime = Date.now()
      setPwdNow(currentTime)
      if (currentTime >= pwdRetryUntil) {
        window.clearInterval(timer)
      }
    }, 250)
    return () => window.clearInterval(timer)
  }, [pwdRetryUntil])

  const pwdRetrySeconds = Math.max(0, Math.ceil((pwdRetryUntil - pwdNow) / 1000))

  // Handle data directory change
  const handleInspectDataDir = async (dir: string) => {
    const result = await window.electronAPI.config.inspectDataDir(dir)
    setDirInspectMessage(t(result.message))
  }

  const handleSelectDir = async () => {
    const selected = await window.electronAPI.config.selectDataDir()
    if (selected) {
      setDataDir(selected)
      setDirMessage({ type: '', text: '' })
      await handleInspectDataDir(selected)
    }
  }

  const handleApplyDir = async () => {
    if (!dataDir.trim()) return

    setDirChanging(true)
    setDirMessage({ type: '', text: '' })

    try {
      const ok = await runAfterPendingSave(async () => {
        const result = await window.electronAPI.config.setDataDir(dataDir.trim())
        if (result.success) {
          setDirMessage({
            type: 'success',
            text: t('{message}。需要重启应用以生效。', { message: t(result.message) }),
          })
        } else {
          setDirMessage({ type: 'error', text: t(result.message) })
        }
      })
      if (!ok) return
    } catch (error) {
      setDirMessage({
        type: 'error',
        text: t('操作失败: {message}', { message: error instanceof Error ? error.message : String(error) }),
      })
    } finally {
      setDirChanging(false)
    }
  }

  const handleRestartApp = async () => {
    await window.electronAPI.config.restartApp()
  }

  // Handle password change
  const handleChangePassword = async () => {
    setPwdMessage({ type: '', text: '' })

    if (!oldPassword) {
      setPwdMessage({ type: 'error', text: t('请输入当前密码') })
      return
    }
    if (!newPassword) {
      setPwdMessage({ type: 'error', text: t('请输入新密码') })
      return
    }
    if (Array.from(newPassword).length < 12) {
      setPwdMessage({ type: 'error', text: t('新密码至少需要 12 个字符') })
      return
    }
    if (newPassword !== confirmNewPassword) {
      setPwdMessage({ type: 'error', text: t('两次输入的新密码不一致') })
      return
    }
    if (oldPassword === newPassword) {
      setPwdMessage({ type: 'error', text: t('新密码不能与旧密码相同') })
      return
    }

    setPwdChanging(true)

    try {
      const ok = await runAfterPendingSave(async () => {
        const result = await window.electronAPI.auth.changePassword(oldPassword, newPassword)
        if (result.success) {
          setPwdMessage({ type: 'success', text: t('密码修改成功！所有文件已使用新密码重新加密。') })
          setPwdRetryUntil(0)
          setOldPassword('')
          setNewPassword('')
          setConfirmNewPassword('')
        } else {
          setPwdMessage({ type: 'error', text: t(result.message || '密码修改失败') })
          if (result.retryAfterMs > 0) {
            const currentTime = Date.now()
            setPwdNow(currentTime)
            setPwdRetryUntil(currentTime + result.retryAfterMs)
          }
        }
      })
      if (!ok) return
    } catch (error) {
      setPwdMessage({
        type: 'error',
        text: t('密码修改失败: {message}', { message: error instanceof Error ? error.message : String(error) }),
      })
    } finally {
      setPwdChanging(false)
    }
  }

  const handleSaveSecurityConfig = async () => {
    setSecuritySaving(true)
    setSecurityMessage({ type: '', text: '' })
    try {
      const config = await window.electronAPI.config.setSecurity({ autoLockMinutes, lockOnMinimize })
      setAutoLockMinutes(config.autoLockMinutes)
      setLockOnMinimize(config.lockOnMinimize)
      window.dispatchEvent(new CustomEvent('arknote:security-config-changed', { detail: config }))
      setSecurityMessage({ type: 'success', text: t('安全设置已保存') })
    } catch (error) {
      setSecurityMessage({ type: 'error', text: t('设置保存失败: {message}', { message: error instanceof Error ? error.message : String(error) }) })
    } finally {
      setSecuritySaving(false)
    }
  }

  // Handle close action change
  const handleCloseActionChange = async (action: 'ask' | 'minimize' | 'quit') => {
    setCloseAction(action)
    await window.electronAPI.window.setCloseAction(action)
  }

  const handleUpdateAction = async () => {
    if (updateState.phase === 'available') {
      setUpdateState(await window.electronAPI.updates.download())
    } else if (updateState.phase === 'downloaded') {
      await window.electronAPI.updates.install()
    } else {
      setUpdateState(await window.electronAPI.updates.check())
    }
  }

  // Sync handlers
  const handleSaveSyncConfig = async () => {
    setSyncing(true)
    setSyncMessage({ type: '', text: '' })
    try {
      const hasGitConfig = syncConfig.provider === 'git' && syncConfig.repoUrl.trim() !== ''
      const hasOssConfig = syncConfig.provider === 'oss' && syncConfig.ossEndpoint.trim() !== '' && syncConfig.ossBucket.trim() !== ''
      const configToSave = { ...syncConfig, enabled: hasGitConfig || hasOssConfig }
      setSyncConfig(configToSave)
      await window.electronAPI.sync.configure(configToSave)
      const status = await window.electronAPI.sync.getStatus()
      setSyncStatus(status)
      setConflicts(status.conflicts ?? [])
      setSyncMessage({
        type: status.status === 'error' ? 'error' : 'success',
        text: status.status === 'error' ? t(status.message) : t('同步配置已保存'),
      })
    } catch (error) {
      setSyncMessage({ type: 'error', text: t('配置失败: {message}', { message: error instanceof Error ? error.message : String(error) }) })
    }
    setSyncing(false)
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncMessage({ type: '', text: '' })
    try {
      const ok = await runAfterPendingSave(async () => {
        const result = await window.electronAPI.sync.sync()
        setSyncStatus(result)
        if (result.status === 'conflict') {
          setConflicts(result.conflicts ?? [])
        } else if (result.status === 'success') {
          setConflicts([])
          await loadData()
          await refreshCurrentNote()
        }
        setSyncMessage({
          type: result.status === 'success' ? 'success' : 'error',
          text: t(result.message),
        })
      })
      if (!ok) return
    } catch (error) {
      setSyncMessage({ type: 'error', text: t('同步失败: {message}', { message: error instanceof Error ? error.message : String(error) }) })
    } finally {
      setSyncing(false)
    }
  }

  const handleResolveConflicts = async () => {
    const resolutions = conflicts
      .filter(c => c.resolution)
      .map(c => ({ file: c.file, resolution: c.resolution! }))
    if (resolutions.length !== conflicts.length) {
      setSyncMessage({ type: 'error', text: t('请为每个冲突文件选择保留版本') })
      return
    }
    setSyncing(true)
    try {
      const ok = await runAfterPendingSave(async () => {
        const result = await window.electronAPI.sync.resolveConflicts(resolutions)
        setSyncStatus(result)
        if (result.status === 'success') {
          await loadData()
          await refreshCurrentNote()
          setConflicts([])
          setSyncMessage({ type: 'success', text: t('冲突已解决，数据已更新') })
        } else if (result.status === 'conflict') {
          setConflicts(result.conflicts ?? [])
          setSyncMessage({ type: 'error', text: t(result.message) })
        } else {
          setSyncMessage({ type: 'error', text: t(result.message) })
        }
      })
      if (!ok) return
    } catch (error) {
      setSyncMessage({ type: 'error', text: t('解决冲突失败: {message}', { message: error instanceof Error ? error.message : String(error) }) })
    } finally {
      setSyncing(false)
    }
  }

  if (!open) return null

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" style={{ width: '560px' }} onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>{t('设置')}</h3>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} strokeWidth={SW} />
          </button>
        </div>

        {/* Apple-style segmented tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '0.5px solid var(--border)',
          padding: '6px 16px',
          gap: '4px',
        }}>
          <button
            className={`sidebar-tab ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
            style={{ flex: 'none', padding: '6px 14px', borderBottom: 'none' }}
          >
            <Monitor size={15} strokeWidth={SW} />
            <span>{t('通用')}</span>
          </button>
          <button
            className={`sidebar-tab ${activeTab === 'storage' ? 'active' : ''}`}
            onClick={() => setActiveTab('storage')}
            style={{ flex: 'none', padding: '6px 14px', borderBottom: 'none' }}
          >
            <HardDrive size={15} strokeWidth={SW} />
            <span>{t('数据存储')}</span>
          </button>
          <button
            className={`sidebar-tab ${activeTab === 'password' ? 'active' : ''}`}
            onClick={() => setActiveTab('password')}
            style={{ flex: 'none', padding: '6px 14px', borderBottom: 'none' }}
          >
            <Key size={15} strokeWidth={SW} />
            <span>{t('密码与安全')}</span>
          </button>
          <button
            className={`sidebar-tab ${activeTab === 'sync' ? 'active' : ''}`}
            onClick={() => setActiveTab('sync')}
            style={{ flex: 'none', padding: '6px 14px', borderBottom: 'none' }}
          >
            <GitBranch size={15} strokeWidth={SW} />
            <span>{t('同步')}</span>
          </button>
        </div>

        <div className="dialog-body" style={{ minHeight: '320px' }}>
          {/* ===== General Tab ===== */}
          {activeTab === 'general' && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ fontSize: '14px', marginBottom: 8, color: 'var(--text-primary)' }}>
                  {t('语言')}
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
                  {t('选择应用界面的显示语言。')}
                </p>
                <div className="language-toggle settings-language-toggle" role="group" aria-label={t('语言')}>
                  <button type="button" className={language === 'zh-CN' ? 'active' : ''} onClick={() => void setLanguage('zh-CN')}>中文</button>
                  <button type="button" className={language === 'en-US' ? 'active' : ''} onClick={() => void setLanguage('en-US')}>English</button>
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <h4 style={{ fontSize: '14px', marginBottom: 8, color: 'var(--text-primary)' }}>
                  {t('外观')}
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
                  {t('选择应用界面的显示模式。')}
                </p>
                <div className="theme-toggle">
                  <button
                    className={theme === 'light' ? 'active' : ''}
                    onClick={() => setTheme('light')}
                  >
                    {t('白天模式')}
                  </button>
                  <button
                    className={theme === 'dark' ? 'active' : ''}
                    onClick={() => setTheme('dark')}
                  >
                    {t('暗夜模式')}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <h4 style={{ fontSize: '14px', marginBottom: 8, color: 'var(--text-primary)' }}>
                  {t('关闭窗口时的操作')}
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                  {t('选择点击关闭按钮后的行为。')}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { value: 'ask' as const, label: t('每次询问'), desc: t('每次点击关闭按钮时弹出选择对话框') },
                    { value: 'minimize' as const, label: t('最小化到托盘'), desc: t('直接隐藏窗口，应用在后台继续运行') },
                    { value: 'quit' as const, label: t('退出应用'), desc: t('直接关闭并退出整个应用程序') },
                  ].map(option => (
                    <label
                      key={option.value}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-lg)',
                        border: `0.5px solid ${closeAction === option.value ? 'var(--accent)' : 'var(--border)'}`,
                        background: closeAction === option.value ? 'var(--accent-dim)' : 'var(--bg-primary)',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
                        boxShadow: closeAction === option.value
                          ? '0 0 0 0.5px var(--accent), var(--shadow-sm)'
                          : 'var(--retina-border)',
                      }}
                    >
                      <input
                        type="radio"
                        name="closeAction"
                        value={option.value}
                        checked={closeAction === option.value}
                        onChange={() => handleCloseActionChange(option.value)}
                        style={{ marginTop: 2, accentColor: 'var(--accent)' }}
                      />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {option.label}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>
                          {option.desc}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ paddingTop: 20, borderTop: '0.5px solid var(--border)' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '14px', marginBottom: 8, color: 'var(--text-primary)' }}>
                  <PackageCheck size={16} strokeWidth={SW} />
                  {t('应用更新')}
                </h4>
                <div className="settings-update-row">
                  <div className="settings-update-copy">
                    <span>{t('当前版本 {version}', { version: updateState.currentVersion || '-' })}</span>
                    <small className={updateState.phase === 'error' ? 'error' : ''}>{t(updateState.message)}</small>
                  </div>
                  <button
                    className="btn"
                    type="button"
                    onClick={handleUpdateAction}
                    disabled={['checking', 'downloading', 'disabled'].includes(updateState.phase)}
                  >
                    {updateState.phase === 'available' ? <Download size={14} strokeWidth={SW} />
                      : updateState.phase === 'downloaded' ? <RotateCcw size={14} strokeWidth={SW} />
                        : <RefreshCw className={updateState.phase === 'checking' ? 'spin' : ''} size={14} strokeWidth={SW} />}
                    {updateState.phase === 'available' ? t('下载更新')
                      : updateState.phase === 'downloaded' ? t('重启安装')
                        : updateState.phase === 'checking' ? t('检查中')
                          : t('检查更新')}
                  </button>
                </div>
                {updateState.phase === 'downloading' && (
                  <div className="update-progress" aria-label={t('下载进度 {progress}%', { progress: Math.round(updateState.progress ?? 0) })}>
                    <span style={{ width: `${updateState.progress ?? 0}%` }} />
                  </div>
                )}
                {updateState.checkedAt && (
                  <div className="settings-update-time">
                    {t('上次检查 {date}', { date: new Date(updateState.checkedAt).toLocaleString(locale) })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== Storage Tab ===== */}
          {activeTab === 'storage' && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ fontSize: '14px', marginBottom: 8, color: 'var(--text-primary)' }}>
                  {t('数据存储目录')}
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                  {t('所有笔记、图片、标签和版本历史都加密存储在此目录中。你可以将此目录指向 Git 仓库、Dropbox、OneDrive 或其他云同步文件夹，实现多平台数据同步。')}
                </p>

                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <input
                    type="text"
                    value={dataDir}
                    onChange={(e) => { setDataDir(e.target.value); setDirMessage({ type: '', text: '' }); setDirInspectMessage('') }}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      background: 'var(--bg-primary)',
                      border: '0.5px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      fontFamily: 'var(--font-mono)',
                      outline: 'none',
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)',
                    }}
                    placeholder={t('选择数据存储目录...')}
                  />
                  <button className="btn" onClick={handleSelectDir}>
                    <FolderOpen size={14} strokeWidth={1.5} />
                    {t('浏览')}
                  </button>
                </div>

                <div style={{
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  padding: '8px 12px',
                  background: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 12,
                  fontFamily: 'var(--font-mono)',
                  lineHeight: 1.8,
                  border: '0.5px solid var(--border)',
                }}>
                  <div>{t('默认目录:')} <span style={{ color: 'var(--text-secondary)' }}>{defaultDataDir}</span></div>
                  <div>{t('配置文件:')} <span style={{ color: 'var(--text-secondary)' }}>{configPath}</span></div>
                </div>

                {dirInspectMessage && (
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '13px',
                    marginBottom: 12,
                    background: 'rgba(239, 68, 68, 0.10)',
                    color: 'var(--error)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    lineHeight: 1.6,
                    border: '0.5px solid rgba(239, 68, 68, 0.28)',
                  }}>
                    <AlertTriangle size={16} strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{dirInspectMessage}</span>
                  </div>
                )}

                {dirMessage.text && (
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '13px',
                    marginBottom: 12,
                    background: dirMessage.type === 'success' ? '#a6e3a122' : '#f38ba822',
                    color: dirMessage.type === 'success' ? 'var(--success)' : 'var(--error)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    {dirMessage.type === 'error' && <AlertTriangle size={16} strokeWidth={1.5} />}
                    <span>{dirMessage.text}</span>
                    {dirMessage.type === 'success' && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={handleRestartApp}
                        style={{ marginLeft: 'auto' }}
                      >
                        <RefreshCw size={12} strokeWidth={1.5} />
                        {t('重启应用')}
                      </button>
                    )}
                  </div>
                )}

                <button
                  className="btn btn-primary"
                  onClick={handleApplyDir}
                  disabled={dirChanging}
                  style={{ width: '100%' }}
                >
                  {dirChanging ? t('应用中...') : t('应用目录变更')}
                </button>
              </div>

              <div style={{
                padding: '14px',
                background: 'var(--accent-dim)',
                borderRadius: 'var(--radius-lg)',
                fontSize: '13px',
                color: 'var(--text-secondary)',
                lineHeight: 1.7,
                border: '0.5px solid var(--border)',
              }}>
                <strong style={{ color: 'var(--accent)' }}>{t('多平台同步提示')}</strong>
                <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                  <li>{t('将数据目录设为 Git 仓库目录，然后通过 GitHub/GitLab 同步')}</li>
                  <li>{t('或将数据目录指向 Dropbox / OneDrive / 坚果云等云盘的同步文件夹')}</li>
                  <li>{t('所有文件都已加密，即使在云端也是安全的')}</li>
                  <li>{t('多台设备使用相同密码即可解锁同一个数据仓库')}</li>
                </ul>
              </div>
            </div>
          )}

          {/* ===== Password Tab ===== */}
          {activeTab === 'password' && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ fontSize: '14px', marginBottom: 8, color: 'var(--text-primary)' }}>
                  {t('修改加密密码')}
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                  {t('修改密码后，所有本地文件将使用新密码重新加密。此操作可能需要一些时间，具体取决于你的笔记和图片数量。')}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
                      {t('当前密码')}
                    </label>
                    <input
                      type="password"
                      value={oldPassword}
                      maxLength={256}
                      onChange={(e) => { setOldPassword(e.target.value); setPwdMessage({ type: '', text: '' }) }}
                      placeholder={t('输入当前密码')}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'var(--bg-primary)',
                        border: '0.5px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
                      {t('新密码（至少 12 个字符）')}
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      maxLength={256}
                      onChange={(e) => { setNewPassword(e.target.value); setPwdMessage({ type: '', text: '' }) }}
                      placeholder={t('输入新密码')}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'var(--bg-primary)',
                        border: '0.5px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
                      {t('确认新密码')}
                    </label>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      maxLength={256}
                      onChange={(e) => { setConfirmNewPassword(e.target.value); setPwdMessage({ type: '', text: '' }) }}
                      placeholder={t('再次输入新密码')}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'var(--bg-primary)',
                        border: '0.5px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {pwdMessage.text && (
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '13px',
                    marginTop: 12,
                    background: pwdMessage.type === 'success' ? '#a6e3a122' : '#f38ba822',
                    color: pwdMessage.type === 'success' ? 'var(--success)' : 'var(--error)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    {pwdMessage.type === 'error' && <AlertTriangle size={16} strokeWidth={1.5} />}
                    <span>{pwdMessage.text}</span>
                  </div>
                )}

                <button
                  className="btn btn-primary"
                  onClick={handleChangePassword}
                  disabled={pwdChanging || pwdRetrySeconds > 0}
                  style={{ width: '100%', marginTop: 16 }}
                >
                  {pwdChanging
                    ? t('加密处理中，请稍候...')
                    : pwdRetrySeconds > 0
                      ? t('请在 {seconds} 秒后重试', { seconds: pwdRetrySeconds })
                      : t('修改密码')}
                </button>
              </div>

              <div style={{ marginBottom: 24, paddingTop: 20, borderTop: '0.5px solid var(--border)' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '14px', marginBottom: 8, color: 'var(--text-primary)' }}>
                  <LockKeyhole size={16} strokeWidth={SW} />
                  {t('自动锁定')}
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '13px', color: 'var(--text-primary)' }}>
                      <Clock3 size={15} strokeWidth={SW} />
                      {t('空闲后锁定')}
                    </span>
                    <select
                      value={autoLockMinutes}
                      onChange={(event) => {
                        setAutoLockMinutes(Number(event.target.value))
                        setSecurityMessage({ type: '', text: '' })
                      }}
                      style={{
                        minWidth: 136,
                        padding: '8px 10px',
                        background: 'var(--bg-primary)',
                        border: '0.5px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    >
                      <option value={0}>{t('从不')}</option>
                      <option value={5}>{t('{minutes} 分钟', { minutes: 5 })}</option>
                      <option value={15}>{t('{minutes} 分钟', { minutes: 15 })}</option>
                      <option value={30}>{t('{minutes} 分钟', { minutes: 30 })}</option>
                      <option value={60}>{t('{minutes} 分钟', { minutes: 60 })}</option>
                    </select>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={lockOnMinimize}
                      onChange={(event) => {
                        setLockOnMinimize(event.target.checked)
                        setSecurityMessage({ type: '', text: '' })
                      }}
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    {t('最小化或隐藏窗口时锁定')}
                  </label>
                </div>

                {securityMessage.text && (
                  <div style={{
                    marginTop: 12,
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: securityMessage.type === 'success' ? '#a6e3a122' : '#f38ba822',
                    color: securityMessage.type === 'success' ? 'var(--success)' : 'var(--error)',
                    fontSize: '13px',
                  }}>
                    {securityMessage.text}
                  </div>
                )}

                <button
                  className="btn"
                  onClick={handleSaveSecurityConfig}
                  disabled={securitySaving}
                  style={{ width: '100%', marginTop: 14 }}
                >
                  {securitySaving ? t('保存中...') : t('保存安全设置')}
                </button>
              </div>

              <div style={{
                padding: '14px',
                background: 'rgba(255, 159, 10, 0.08)',
                borderRadius: 'var(--radius-lg)',
                fontSize: '13px',
                color: 'var(--warning)',
                lineHeight: 1.7,
                border: '0.5px solid rgba(255, 159, 10, 0.2)',
              }}>
                <strong>{t('注意事项')}</strong>
                <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                  <li>{t('修改密码会重新加密所有文件（笔记、图片、版本历史）')}</li>
                  <li>{t('请务必记住新密码，密码丢失将无法恢复数据')}</li>
                  <li>{t('如果你使用多平台同步，所有设备都需要使用新密码')}</li>
                  <li>{t('处理过程中请勿关闭应用')}</li>
                </ul>
              </div>
            </div>
          )}

          {/* ===== Sync Tab ===== */}
          {activeTab === 'sync' && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ fontSize: '14px', marginBottom: 8, color: 'var(--text-primary)' }}>
                  {t('同步配置')}
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                  {t('配置远程仓库或 OSS 来同步你的加密笔记数据。')}
                </p>

                {/* Provider selection */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
                    {t('同步方式')}
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className={`btn ${syncConfig.provider === 'git' ? 'btn-primary' : ''}`}
                      onClick={() => setSyncConfig({ ...syncConfig, provider: 'git' })}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}
                    >
                      <GitBranch size={14} strokeWidth={1.5} /> GitHub / GitLab
                    </button>
                    <button
                      className={`btn ${syncConfig.provider === 'oss' ? 'btn-primary' : ''}`}
                      onClick={() => setSyncConfig({ ...syncConfig, provider: 'oss' })}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}
                    >
                      <Cloud size={14} strokeWidth={1.5} /> {t('OSS 对象存储')}
                    </button>
                  </div>
                </div>

                {/* Git config */}
                {syncConfig.provider === 'git' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                    <div>
                      <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
                        {t('仓库地址（HTTPS 或 SSH）')}
                      </label>
                      <input
                        type="text"
                        value={syncConfig.repoUrl}
                        onChange={(e) => setSyncConfig({ ...syncConfig, repoUrl: e.target.value })}
                        placeholder={t('https://github.com/user/repo.git 或 git@github.com:user/repo.git')}
                        style={{
                          width: '100%', padding: '10px 14px',
                          background: 'var(--bg-primary)', border: '0.5px solid var(--border)',
                          borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                          fontSize: '13px', fontFamily: 'var(--font-mono)', outline: 'none',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
                        {t('分支名称')}
                      </label>
                      <input
                        type="text"
                        value={syncConfig.branch}
                        onChange={(e) => setSyncConfig({ ...syncConfig, branch: e.target.value })}
                        placeholder="main"
                        style={{
                          width: '100%', padding: '10px 14px',
                          background: 'var(--bg-primary)', border: '0.5px solid var(--border)',
                          borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                          fontSize: '13px', outline: 'none',
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* OSS config */}
                {syncConfig.provider === 'oss' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                    <div>
                      <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
                        Endpoint
                      </label>
                      <input
                        type="text"
                        value={syncConfig.ossEndpoint}
                        onChange={(e) => setSyncConfig({ ...syncConfig, ossEndpoint: e.target.value })}
                        placeholder="https://oss-cn-hangzhou.aliyuncs.com"
                        style={{
                          width: '100%', padding: '10px 14px',
                          background: 'var(--bg-primary)', border: '0.5px solid var(--border)',
                          borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                          fontSize: '13px', fontFamily: 'var(--font-mono)', outline: 'none',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
                          {t('Bucket 名称')}
                        </label>
                        <input
                          type="text"
                          value={syncConfig.ossBucket}
                          onChange={(e) => setSyncConfig({ ...syncConfig, ossBucket: e.target.value })}
                          placeholder="my-notes-bucket"
                          style={{
                            width: '100%', padding: '10px 14px',
                            background: 'var(--bg-primary)', border: '0.5px solid var(--border)',
                            borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                            fontSize: '13px', outline: 'none',
                          }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
                          Region
                        </label>
                        <input
                          type="text"
                          value={syncConfig.ossRegion}
                          onChange={(e) => setSyncConfig({ ...syncConfig, ossRegion: e.target.value })}
                          placeholder="oss-cn-hangzhou"
                          style={{
                            width: '100%', padding: '10px 14px',
                            background: 'var(--bg-primary)', border: '0.5px solid var(--border)',
                            borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                            fontSize: '13px', outline: 'none',
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
                        Access Key ID
                      </label>
                      <input
                        type="text"
                        value={syncConfig.ossAccessKey}
                        onChange={(e) => setSyncConfig({ ...syncConfig, ossAccessKey: e.target.value })}
                        placeholder="LTAI5t..."
                        style={{
                          width: '100%', padding: '10px 14px',
                          background: 'var(--bg-primary)', border: '0.5px solid var(--border)',
                          borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                          fontSize: '13px', fontFamily: 'var(--font-mono)', outline: 'none',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
                        Access Key Secret
                      </label>
                      <input
                        type="password"
                        value={syncConfig.ossSecretKey}
                        onChange={(e) => setSyncConfig({ ...syncConfig, ossSecretKey: e.target.value })}
                        placeholder="••••••••"
                        style={{
                          width: '100%', padding: '10px 14px',
                          background: 'var(--bg-primary)', border: '0.5px solid var(--border)',
                          borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                          fontSize: '13px', outline: 'none',
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Auto sync */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
                  padding: '12px 14px', background: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-md)',
                }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={syncConfig.autoSync}
                      onChange={(e) => setSyncConfig({ ...syncConfig, autoSync: e.target.checked })}
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{t('自动同步')}</span>
                  </label>
                  {syncConfig.autoSync && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('每')}</span>
                      <input
                        type="number"
                        min="5"
                        max="1440"
                        value={syncConfig.syncInterval}
                        onChange={(e) => setSyncConfig({ ...syncConfig, syncInterval: parseInt(e.target.value) || 30 })}
                        style={{
                          width: 60, padding: '6px 10px', textAlign: 'center',
                          background: 'var(--bg-surface)', border: '0.5px solid var(--border)',
                          borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                          fontSize: '13px', outline: 'none',
                        }}
                      />
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('分钟')}</span>
                    </div>
                  )}
                </div>

                {/* Save config button */}
                <button
                  className="btn btn-primary"
                  onClick={handleSaveSyncConfig}
                  disabled={syncing}
                  style={{ width: '100%', marginBottom: 20 }}
                >
                  {syncing ? t('保存中...') : t('保存同步配置')}
                </button>

                {/* Sync actions */}
                <h4 style={{ fontSize: '14px', marginBottom: 12, color: 'var(--text-primary)' }}>
                  {t('同步操作')}
                </h4>
                <button
                  className="btn"
                  onClick={handleSync}
                  disabled={syncing}
                  style={{ width: '100%', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}
                >
                  <RefreshCw size={14} strokeWidth={1.5} className={syncing ? 'spin' : ''} />
                  {syncing ? t('同步中...') : t('立即同步')}
                </button>

                {/* Sync status */}
                <div style={{
                  padding: '10px 14px', borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-primary)', fontSize: '13px', marginBottom: 12,
                  color: 'var(--text-secondary)',
                }}>
                  <span>{t('状态:')} </span>
                  <span style={{
                    color: syncStatus.status === 'success' ? 'var(--success)'
                      : syncStatus.status === 'error' ? 'var(--error)'
                      : syncStatus.status === 'conflict' ? 'var(--warning)'
                      : 'var(--text-muted)',
                  }}>
                    {syncStatus.message ? t(syncStatus.message) : t('就绪')}
                  </span>
                  {syncStatus.lastSync && (
                    <span style={{ marginLeft: 12, color: 'var(--text-muted)', fontSize: '12px' }}>
                      {t('上次同步: {date}', { date: new Date(syncStatus.lastSync).toLocaleString(locale) })}
                    </span>
                  )}
                </div>

                {syncMessage.text && (
                  <div style={{
                    padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '13px',
                    marginBottom: 12,
                    background: syncMessage.type === 'success' ? '#a6e3a122' : '#f38ba822',
                    color: syncMessage.type === 'success' ? 'var(--success)' : 'var(--error)',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    {syncMessage.type === 'success' ? <CheckCircle size={16} strokeWidth={1.5} /> : <AlertTriangle size={16} strokeWidth={1.5} />}
                    <span>{syncMessage.text}</span>
                  </div>
                )}

                {/* Conflict resolution UI */}
                {conflicts.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <h4 style={{ fontSize: '14px', marginBottom: 12, color: 'var(--warning)' }}>
                      {t('冲突文件 ({count})', { count: conflicts.length })}
                    </h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
                      {t('加密文件无法自动合并，请为每个文件选择要保留的完整版本。未选择的一侧将被覆盖。')}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                      {conflicts.map((conflict, index) => (
                        <div
                          key={conflict.file}
                          style={{
                            padding: '12px 14px', borderRadius: 'var(--radius-md)',
                            border: '0.5px solid var(--border)', background: 'var(--bg-primary)',
                          }}
                        >
                          <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
                            {conflict.file}
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              className={`btn btn-sm ${conflict.resolution === 'local' ? 'btn-primary' : ''}`}
                              onClick={() => {
                                const newConflicts = [...conflicts]
                                newConflicts[index] = { ...conflict, resolution: 'local', resolved: true }
                                setConflicts(newConflicts)
                              }}
                              style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}
                            >
                              <CheckCircle size={12} strokeWidth={1.5} /> {t('保留本地')}
                            </button>
                            <button
                              className={`btn btn-sm ${conflict.resolution === 'remote' ? 'btn-primary' : ''}`}
                              onClick={() => {
                                const newConflicts = [...conflicts]
                                newConflicts[index] = { ...conflict, resolution: 'remote', resolved: true }
                                setConflicts(newConflicts)
                              }}
                              style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}
                            >
                              <XCircle size={12} strokeWidth={1.5} /> {t('使用远程')}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={handleResolveConflicts}
                      disabled={syncing || conflicts.some(c => !c.resolution)}
                      style={{ width: '100%' }}
                    >
                      {syncing ? t('处理中...') : t('解决冲突并继续同步')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
