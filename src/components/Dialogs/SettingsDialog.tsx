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
    httpsToken: '',
    autoSync: false,
    syncInterval: 30,
  })
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ lastSync: null, status: 'idle', message: '' })
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error' | ''; text: string }>({ type: '', text: '' })
  const [syncing, setSyncing] = useState(false)
  const [conflicts, setConflicts] = useState<SyncConflict[]>([])
  const [vaultMessage, setVaultMessage] = useState<{ type: 'success' | 'error' | ''; text: string }>({ type: '', text: '' })
  const [integrityText, setIntegrityText] = useState('')
  const [editorFontSize, setEditorFontSize] = useState(16)
  const [editorDefaultView, setEditorDefaultView] = useState<'edit' | 'preview' | 'split'>('split')
  const [coldBackup, setColdBackup] = useState({
    enabled: false,
    endpoint: '',
    bucket: '',
    region: '',
    accessKeyId: '',
    secretAccessKey: '',
    prefix: 'arknote-cold',
    intervalHours: 24,
    lastBackupAt: null as string | null,
    lastError: null as string | null,
  })
  const [coldMessage, setColdMessage] = useState<{ type: 'success' | 'error' | ''; text: string }>({ type: '', text: '' })
  const [coldBusy, setColdBusy] = useState(false)

  // Active tab
  const [activeTab, setActiveTab] = useState<'storage' | 'password' | 'general' | 'sync' | 'backup'>('general')

  // Load config on open
  useEffect(() => {
    if (!open) return
    const loadConfig = async () => {
      try {
        const [config, action, sConfig, sStatus, authStatus, appUpdate, cold] = await Promise.all([
          window.electronAPI.config.getAll(),
          window.electronAPI.window.getCloseAction(),
          window.electronAPI.sync.getConfig(),
          window.electronAPI.sync.getStatus(),
          window.electronAPI.auth.getUnlockStatus(),
          window.electronAPI.updates.getState(),
          window.electronAPI.coldBackup.getConfig(),
        ])
        setDataDir(config.dataDir)
        setDefaultDataDir(config.defaultDataDir)
        setConfigPath(config.configPath)
        setDirInspectMessage('')
        setCloseAction(action)
        setAutoLockMinutes(config.autoLockMinutes)
        setLockOnMinimize(config.lockOnMinimize)
        setEditorFontSize(config.editorFontSize || 16)
        setEditorDefaultView(config.editorDefaultView || 'split')
        const currentTime = Date.now()
        setPwdNow(currentTime)
        setPwdRetryUntil(currentTime + authStatus.retryAfterMs)
        setSyncConfig({
          enabled: sConfig.enabled,
          provider: 'git',
          repoUrl: sConfig.repoUrl || '',
          branch: sConfig.branch || 'main',
          httpsToken: sConfig.httpsToken || '',
          autoSync: sConfig.autoSync,
          syncInterval: sConfig.syncInterval,
        })
        setSyncStatus(sStatus)
        setUpdateState(appUpdate)
        setColdBackup(cold)
        if (sStatus.conflicts && sStatus.conflicts.length > 0) {
          setConflicts(sStatus.conflicts)
        }

        // Trigger a fresh check when opening settings if never checked or last check failed
        if (!appUpdate.checkedAt || appUpdate.phase === 'error' || appUpdate.phase === 'idle') {
          setUpdateState(await window.electronAPI.updates.check())
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
      const hasGitConfig = syncConfig.repoUrl.trim() !== ''
      const configToSave: SyncConfig = {
        ...syncConfig,
        provider: 'git',
        enabled: hasGitConfig,
      }
      setSyncConfig(configToSave)
      await window.electronAPI.sync.configure(configToSave)
      const status = await window.electronAPI.sync.getStatus()
      setSyncStatus(status)
      setConflicts(status.conflicts ?? [])
      useStore.getState().setSyncStatus(status)
      setSyncMessage({
        type: status.status === 'error' ? 'error' : 'success',
        text: status.status === 'error' ? t(status.message) : t('同步配置已保存'),
      })
    } catch (error) {
      setSyncMessage({ type: 'error', text: t('配置失败: {message}', { message: error instanceof Error ? error.message : String(error) }) })
    }
    setSyncing(false)
  }

  const handleExportVault = async () => {
    setVaultMessage({ type: '', text: '' })
    const result = await window.electronAPI.vault.exportBackup()
    setVaultMessage({
      type: result.success ? 'success' : result.canceled ? '' : 'error',
      text: result.canceled ? '' : t(result.message),
    })
  }

  const handleVerifyIntegrity = async () => {
    setVaultMessage({ type: '', text: '' })
    const report = await window.electronAPI.vault.verifyIntegrity()
    const summary = report.ok
      ? t('仓库完整性正常：笔记 {notesOk}/{notesChecked}，图片 {imagesOk}/{imagesChecked}', {
        notesOk: report.notesOk,
        notesChecked: report.notesChecked,
        imagesOk: report.imagesOk,
        imagesChecked: report.imagesChecked,
      })
      : t('发现 {count} 个问题', { count: report.issues.length })
    setIntegrityText([
      summary,
      ...report.issues.slice(0, 8).map(i => `• [${i.severity}] ${i.message}`),
    ].join('\n'))
    setVaultMessage({ type: report.ok ? 'success' : 'error', text: summary })
  }

  const handleSaveEditorPrefs = async () => {
    await window.electronAPI.notesExtras.setEditorPrefs({
      fontSize: editorFontSize,
      defaultView: editorDefaultView,
    })
  }

  const applyColdPreset = (preset: string) => {
    if (preset === 'aws') {
      setColdBackup({ ...coldBackup, endpoint: 'https://s3.amazonaws.com', region: 'us-east-1' })
    } else if (preset === 'r2') {
      setColdBackup({ ...coldBackup, endpoint: 'https://<accountid>.r2.cloudflarestorage.com', region: 'auto' })
    } else if (preset === 'minio') {
      setColdBackup({ ...coldBackup, endpoint: 'http://127.0.0.1:9000', region: 'us-east-1' })
    } else if (preset === 'oss') {
      setColdBackup({ ...coldBackup, endpoint: 'https://oss-cn-hangzhou.aliyuncs.com', region: 'oss-cn-hangzhou' })
    } else if (preset === 'cos') {
      setColdBackup({ ...coldBackup, endpoint: 'https://cos.ap-guangzhou.myqcloud.com', region: 'ap-guangzhou' })
    }
  }

  const formatColdResult = (result: { success: boolean; message: string; detail?: string }) => {
    if (result.success) return result.message
    return result.detail ? `${result.message}\n${result.detail}` : result.message
  }

  const handleSaveColdBackup = async () => {
    setColdMessage({ type: '', text: '' })
    try {
      const saved = await window.electronAPI.coldBackup.setConfig(coldBackup)
      setColdBackup(saved)
      setColdMessage({ type: 'success', text: t('冷备份配置已保存（凭证仅存本机）') })
    } catch (error) {
      setColdMessage({ type: 'error', text: error instanceof Error ? error.message : String(error) })
    }
  }

  const handleRunColdBackup = async () => {
    setColdMessage({ type: '', text: '' })
    setColdBusy(true)
    try {
      const result = await window.electronAPI.coldBackup.runNow()
      setColdMessage({ type: result.success ? 'success' : 'error', text: formatColdResult(result) })
      setColdBackup(await window.electronAPI.coldBackup.getConfig())
    } finally {
      setColdBusy(false)
    }
  }

  const handleTestColdBackup = async () => {
    setColdMessage({ type: '', text: '' })
    setColdBusy(true)
    try {
      await window.electronAPI.coldBackup.setConfig(coldBackup)
      const result = await window.electronAPI.coldBackup.testConnection()
      setColdMessage({ type: result.success ? 'success' : 'error', text: formatColdResult(result) })
      setColdBackup(await window.electronAPI.coldBackup.getConfig())
    } finally {
      setColdBusy(false)
    }
  }

  const handleRestoreColdBackup = async () => {
    const ok = window.confirm(t('仅可恢复到空数据目录。若当前目录已有笔记，请先更换空目录或备份后再试。继续？'))
    if (!ok) return
    setColdMessage({ type: '', text: '' })
    setColdBusy(true)
    try {
      const result = await window.electronAPI.coldBackup.restoreFromFile()
      setColdMessage({ type: result.success ? 'success' : 'error', text: formatColdResult(result) })
    } finally {
      setColdBusy(false)
    }
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
          <button
            className={`sidebar-tab ${activeTab === 'backup' ? 'active' : ''}`}
            onClick={() => setActiveTab('backup')}
            style={{ flex: 'none', padding: '6px 14px', borderBottom: 'none' }}
          >
            <Cloud size={15} strokeWidth={SW} />
            <span>{t('备份')}</span>
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
                  {t('编辑器')}
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
                  {t('字号与默认视图会保存在本机配置中。')}
                </p>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('字号')}</label>
                  <input
                    type="number"
                    min={12}
                    max={28}
                    value={editorFontSize}
                    onChange={(e) => setEditorFontSize(parseInt(e.target.value) || 16)}
                    style={{ width: 64, padding: '6px 8px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)' }}
                  />
                  <select
                    value={editorDefaultView}
                    onChange={(e) => setEditorDefaultView(e.target.value as 'edit' | 'preview' | 'split')}
                    style={{ padding: '6px 8px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)' }}
                  >
                    <option value="edit">{t('仅编辑')}</option>
                    <option value="preview">{t('仅预览')}</option>
                    <option value="split">{t('分栏')}</option>
                  </select>
                  <button className="btn" onClick={handleSaveEditorPrefs}>{t('保存')}</button>
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <h4 style={{ fontSize: '14px', marginBottom: 8, color: 'var(--text-primary)' }}>
                  {t('关闭窗口时的操作')}
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
                  {t('选择点击关闭按钮后的行为。')}
                </p>
                <select
                  value={closeAction}
                  onChange={(event) => handleCloseActionChange(event.target.value as 'ask' | 'minimize' | 'quit')}
                  aria-label={t('关闭窗口时的操作')}
                  style={{
                    minWidth: 200,
                    padding: '8px 10px',
                    background: 'var(--bg-primary)',
                    border: '0.5px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                >
                  <option value="ask">{t('每次询问')}</option>
                  <option value="minimize">{t('最小化到托盘')}</option>
                  <option value="quit">{t('退出应用')}</option>
                </select>
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
                  {t('Git 是当前唯一稳定同步方式。对象存储请使用「备份」页的加密冷备份，不会做双向同步。')}
                </p>
                <ol style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 16, paddingLeft: 18, lineHeight: 1.7 }}>
                  <li>{t('在 GitHub/GitLab 创建私有空仓库')}</li>
                  <li>{t('粘贴 HTTPS 或 SSH 地址；HTTPS 私有库请填写访问令牌')}</li>
                  <li>{t('保存配置后点击「立即同步」')}</li>
                </ol>

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
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
                      {t('HTTPS 访问令牌（可选，仅存本机）')}
                    </label>
                    <input
                      type="password"
                      value={syncConfig.httpsToken || ''}
                      onChange={(e) => setSyncConfig({ ...syncConfig, httpsToken: e.target.value })}
                      placeholder={t('GitHub PAT / GitLab Token')}
                      style={{
                        width: '100%', padding: '10px 14px',
                        background: 'var(--bg-primary)', border: '0.5px solid var(--border)',
                        borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                        fontSize: '13px', fontFamily: 'var(--font-mono)', outline: 'none',
                      }}
                    />
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 6 }}>
                      {t('令牌保存在 ~/.ark-note-config.json，不会写入加密仓库或 Git 远端。')}
                    </p>
                  </div>
                </div>

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
                          <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: 4, fontWeight: 600 }}>
                            {conflict.displayName || conflict.file}
                          </div>
                          {conflict.displayName && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
                              {conflict.file}
                            </div>
                          )}
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

          {/* ===== Backup Tab ===== */}
          {activeTab === 'backup' && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ fontSize: '14px', marginBottom: 8, color: 'var(--text-primary)' }}>
                  {t('加密仓库备份')}
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
                  {t('导出整份密文仓库到 U 盘或其它位置。备份仍需原密码才能解锁。')}
                </p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <button className="btn btn-primary" onClick={handleExportVault} style={{ flex: 1 }}>
                    {t('导出加密备份')}
                  </button>
                  <button className="btn" onClick={handleVerifyIntegrity} style={{ flex: 1 }}>
                    {t('验证仓库完整性')}
                  </button>
                </div>
                {vaultMessage.text && (
                  <div style={{
                    padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '13px', marginBottom: 12,
                    background: vaultMessage.type === 'success' ? '#a6e3a122' : '#f38ba822',
                    color: vaultMessage.type === 'success' ? 'var(--success)' : 'var(--error)',
                  }}>
                    {vaultMessage.text}
                  </div>
                )}
                {integrityText && (
                  <pre style={{
                    whiteSpace: 'pre-wrap', fontSize: 12, padding: 12, borderRadius: 8,
                    background: 'var(--bg-primary)', border: '0.5px solid var(--border)',
                    color: 'var(--text-secondary)', maxHeight: 160, overflow: 'auto',
                  }}>{integrityText}</pre>
                )}
              </div>

              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: '14px', marginBottom: 8, color: 'var(--text-primary)' }}>
                  {t('对象存储冷备份')}
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
                  {t('定时上传密文快照到 S3 兼容存储。这不是实时同步；凭证只保存在本机配置。')}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
                  {t('使用 path-style：Endpoint/Bucket/对象键。可先选厂商预设再改成你的真实 Endpoint。')}
                </p>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={coldBackup.enabled}
                    onChange={(e) => setColdBackup({ ...coldBackup, enabled: e.target.checked })}
                  />
                  {t('启用定时冷备份')}
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) applyColdPreset(e.target.value)
                      e.target.value = ''
                    }}
                    style={{
                      width: '100%', padding: '8px 12px', background: 'var(--bg-primary)',
                      border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)', fontSize: 13,
                    }}
                  >
                    <option value="" disabled>{t('厂商预设（填充 Endpoint / Region）')}</option>
                    <option value="aws">AWS S3</option>
                    <option value="r2">Cloudflare R2</option>
                    <option value="minio">MinIO</option>
                    <option value="oss">阿里云 OSS</option>
                    <option value="cos">腾讯云 COS</option>
                  </select>
                  {(['endpoint', 'bucket', 'region', 'accessKeyId', 'secretAccessKey', 'prefix'] as const).map((key) => (
                    <input
                      key={key}
                      type={key === 'secretAccessKey' ? 'password' : 'text'}
                      value={coldBackup[key]}
                      onChange={(e) => setColdBackup({ ...coldBackup, [key]: e.target.value })}
                      placeholder={key}
                      style={{
                        width: '100%', padding: '8px 12px', background: 'var(--bg-primary)',
                        border: '0.5px solid var(--border)', borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-mono)',
                      }}
                    />
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span>{t('间隔（小时）')}</span>
                    <input
                      type="number"
                      min={1}
                      max={168}
                      value={coldBackup.intervalHours}
                      onChange={(e) => setColdBackup({ ...coldBackup, intervalHours: parseInt(e.target.value) || 24 })}
                      style={{ width: 72, padding: '6px 8px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)' }}
                    />
                    {coldBackup.lastBackupAt && (
                      <span>{t('上次: {date}', { date: new Date(coldBackup.lastBackupAt).toLocaleString(locale) })}</span>
                    )}
                  </div>
                  {coldBackup.lastError && (
                    <div style={{ fontSize: 12, color: 'var(--error)', lineHeight: 1.5 }}>
                      {t('上次失败')}: {coldBackup.lastError}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" disabled={coldBusy} onClick={() => void handleSaveColdBackup()} style={{ flex: 1 }}>{t('保存冷备份配置')}</button>
                  <button className="btn" disabled={coldBusy} onClick={() => void handleTestColdBackup()} style={{ flex: 1 }}>{t('测试连接')}</button>
                  <button className="btn" disabled={coldBusy} onClick={() => void handleRunColdBackup()} style={{ flex: 1 }}>{t('立即冷备份')}</button>
                  <button className="btn" disabled={coldBusy} onClick={() => void handleRestoreColdBackup()} style={{ flex: 1 }}>{t('从冷备份文件恢复')}</button>
                </div>
                {coldMessage.text && (
                  <div style={{
                    marginTop: 12, padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: 13,
                    whiteSpace: 'pre-wrap',
                    background: coldMessage.type === 'success' ? '#a6e3a122' : '#f38ba822',
                    color: coldMessage.type === 'success' ? 'var(--success)' : 'var(--error)',
                  }}>{coldMessage.text}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

