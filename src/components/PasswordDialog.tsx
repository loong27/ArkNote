import React, { useState, useCallback, useEffect } from 'react'
import { ArrowLeft, ChevronRight, CloudDownload, Database, Eye, EyeOff, Shield, KeyRound } from 'lucide-react'
import { useStore } from '../store/useStore'
import { DefaultAvatar } from './common/DefaultAvatar'
import { useI18n } from '../i18n/I18nProvider'

type Mode = 'loading' | 'choice' | 'setup' | 'restore' | 'unlock'

/**
 * Password dialog — Apple Authentication Sheet style.
 * Uses glassmorphism surface with inner bezel highlight,
 * Apple "Glow Ring" focus indicators, and gradient buttons.
 */
export const PasswordDialog: React.FC = () => {
  const { language, setLanguage, t } = useI18n()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<Mode>('loading')
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [restoreRepoUrl, setRestoreRepoUrl] = useState('')
  const [restoreBranch, setRestoreBranch] = useState('main')
  const [restoreError, setRestoreError] = useState('')
  const [restoring, setRestoring] = useState(false)
  const [restored, setRestored] = useState(false)

  const { setLocked, loadData } = useStore()

  // Determine if first-time setup or existing vault, and load theme
  useEffect(() => {
    const check = async () => {
      try {
        // Load theme early so password dialog respects user's preference
        const theme = await window.electronAPI.config.getTheme()
        document.documentElement.setAttribute('data-theme', theme)
        useStore.getState().setTheme(theme)

        // Check if already unlocked
        const locked = await window.electronAPI.auth.isLocked()
        if (!locked) {
          await loadData()
          setLocked(false)
          return
        }

        // Check if it's a new vault (no salt.bin)
        const firstTime = await window.electronAPI.auth.isFirstTime()
        setMode(firstTime ? 'choice' : 'unlock')
        if (!firstTime) {
          const status = await window.electronAPI.auth.getUnlockStatus()
          if (status.retryAfterMs > 0) {
            setCooldownUntil(Date.now() + status.retryAfterMs)
          }
        }
      } catch {
        setMode('unlock')
      }
    }
    check()
  }, [setLocked, loadData])

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return
    const timer = window.setInterval(() => {
      const currentTime = Date.now()
      setNow(currentTime)
      if (currentTime >= cooldownUntil) {
        window.clearInterval(timer)
      }
    }, 250)
    return () => window.clearInterval(timer)
  }, [cooldownUntil])

  const cooldownSeconds = Math.max(0, Math.ceil((cooldownUntil - now) / 1000))

  const applyFailure = useCallback((result: { message?: string; retryAfterMs: number }) => {
    setError(t(result.message || '操作失败，请重试'))
    if (result.retryAfterMs > 0) {
      const currentTime = Date.now()
      setNow(currentTime)
      setCooldownUntil(currentTime + result.retryAfterMs)
    }
  }, [t])

  const handleSetup = useCallback(async () => {
    if (!password) {
      setError(t('请设置加密密码'))
      return
    }
    if (Array.from(password).length < 12) {
      setError(t('密码至少需要 12 个字符'))
      return
    }
    if (password !== confirmPassword) {
      setError(t('两次输入的密码不一致'))
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await window.electronAPI.auth.unlock(password)
      if (result.success) {
        await loadData()
        setLocked(false)
      } else {
        applyFailure(result)
      }
    } catch {
      setError(t('初始化失败，请重试'))
    }
    setLoading(false)
  }, [password, confirmPassword, setLocked, loadData, applyFailure])

  const handleUnlock = useCallback(async () => {
    if (loading || cooldownSeconds > 0) return
    if (!password) {
      setError(t('请输入密码'))
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await window.electronAPI.auth.unlock(password)
      if (result.success) {
        await loadData()
        setLocked(false)
      } else {
        applyFailure(result)
      }
    } catch {
      setError(t('解锁失败，请重试'))
    }
    setLoading(false)
  }, [password, setLocked, loadData, loading, cooldownSeconds, applyFailure])

  const handleRestore = useCallback(async () => {
    if (restoring) return
    if (!restoreRepoUrl.trim()) {
      setRestoreError(t('请输入 GitHub 仓库地址'))
      return
    }

    setRestoring(true)
    setRestoreError('')
    try {
      const result = await window.electronAPI.auth.restoreFromGit({
        repoUrl: restoreRepoUrl.trim(),
        branch: restoreBranch.trim() || 'main',
      })
      if (!result.success) {
        setRestoreError(t(result.message))
        return
      }

      setRestored(true)
      setPassword('')
      setMode('unlock')
    } catch {
      setRestoreError(t('恢复失败，请检查网络和仓库权限后重试'))
    } finally {
      setRestoring(false)
    }
  }, [restoreBranch, restoreRepoUrl, restoring])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (loading || cooldownSeconds > 0) return
      if (mode === 'setup') {
        handleSetup()
      } else if (mode === 'restore') {
        handleRestore()
      } else {
        handleUnlock()
      }
    }
  }

  const languageToggle = (
    <div className="language-toggle auth-language-toggle" role="group" aria-label="Language">
      <button type="button" className={language === 'zh-CN' ? 'active' : ''} onClick={() => void setLanguage('zh-CN')}>中文</button>
      <button type="button" className={language === 'en-US' ? 'active' : ''} onClick={() => void setLanguage('en-US')}>English</button>
    </div>
  )

  if (mode === 'choice') {
    return (
      <div className="password-overlay">
        <div className="password-dialog password-dialog-choice">
          {languageToggle}
          <div className="auth-brand-lockup">
            <DefaultAvatar alt="arkNote" size={72} />
          </div>
          <h1>{t('欢迎使用 arkNote')}</h1>
          <p>{t('选择新建加密仓库，或恢复已有的 GitHub 数据。')}</p>

          <div className="setup-choice-list">
            <button className="setup-choice-button" type="button" onClick={() => setMode('setup')}>
              <span className="setup-choice-icon"><Database size={20} strokeWidth={1.7} /></span>
              <span className="setup-choice-copy">
                <strong>{t('创建新仓库')}</strong>
                <small>{t('设置新密码并初始化本地加密数据')}</small>
              </span>
              <ChevronRight size={18} strokeWidth={1.7} />
            </button>
            <button className="setup-choice-button" type="button" onClick={() => setMode('restore')}>
              <span className="setup-choice-icon"><CloudDownload size={20} strokeWidth={1.7} /></span>
              <span className="setup-choice-copy">
                <strong>{t('从 GitHub 恢复')}</strong>
                <small>{t('拉取已有加密仓库并使用原密码解锁')}</small>
              </span>
              <ChevronRight size={18} strokeWidth={1.7} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (mode === 'restore') {
    return (
      <div className="password-overlay">
        <div className="password-dialog">
          {languageToggle}
          <div className="auth-flow-nav">
            <button type="button" className="auth-back-button" onClick={() => { setRestoreError(''); setMode('choice') }} title={t('返回')}>
              <ArrowLeft size={18} strokeWidth={1.7} />
            </button>
          </div>
          <div className="auth-brand-lockup">
            <DefaultAvatar alt="arkNote" size={72} />
            <span className="auth-brand-badge" aria-hidden="true">
              <CloudDownload size={15} strokeWidth={2} />
            </span>
          </div>

          <h1>{t('恢复加密仓库')}</h1>
          <p>{t('仓库将恢复到当前空数据目录，完成后使用原密码解锁。')}</p>

          <div className="input-group restore-inputs">
            <div>
              <label>{t('GitHub 仓库地址')}</label>
              <input
                type="text"
                value={restoreRepoUrl}
                maxLength={512}
                onChange={(event) => { setRestoreRepoUrl(event.target.value); setRestoreError('') }}
                onKeyDown={handleKeyDown}
                placeholder="git@github.com:user/notes.git"
                autoFocus
              />
            </div>
            <div>
              <label>{t('分支')}</label>
              <input
                type="text"
                value={restoreBranch}
                maxLength={200}
                onChange={(event) => { setRestoreBranch(event.target.value); setRestoreError('') }}
                onKeyDown={handleKeyDown}
                placeholder="main"
              />
            </div>
            {restoreError && <div className="error-msg">{restoreError}</div>}
          </div>

          <button onClick={handleRestore} disabled={restoring}>
            {restoring ? t('正在从 GitHub 恢复...') : t('恢复加密数据')}
          </button>
        </div>
      </div>
    )
  }

  // ====== Loading State ======
  if (mode === 'loading') {
    return (
      <div className="password-overlay">
        <div className="password-dialog" style={{ textAlign: 'center', padding: '60px 40px' }}>
          {languageToggle}
          <div className="auth-brand-lockup auth-brand-lockup-loading">
            <DefaultAvatar alt="arkNote" size={72} />
          </div>
          <h1>arkNote</h1>
          <p style={{ color: 'var(--text-muted)' }}>{t('正在加载...')}</p>
        </div>
      </div>
    )
  }

  // ====== First-time Setup Mode ======
  if (mode === 'setup') {
    return (
      <div className="password-overlay">
        <div className="password-dialog">
          {languageToggle}
          <div className="auth-flow-nav">
            <button type="button" className="auth-back-button" onClick={() => setMode('choice')} title={t('返回')}>
              <ArrowLeft size={18} strokeWidth={1.7} />
            </button>
          </div>
          <div className="auth-brand-lockup">
            <DefaultAvatar alt="arkNote" size={72} />
            <span className="auth-brand-badge" aria-hidden="true">
              <Shield size={15} strokeWidth={2} />
            </span>
          </div>

          <h1>{t('欢迎使用 arkNote')}</h1>
          <p style={{ marginBottom: 8, lineHeight: 1.6 }}>
            {t('首次使用需要设置加密密码。此密码用于加密所有本地文件，')}
            <br /><strong style={{ color: 'var(--warning)' }}>{t('请务必牢记密码，密码丢失将无法恢复数据。')}</strong>
          </p>

          <div className="input-group">
            <div>
              <label style={{
                fontSize: '12px',
                color: 'var(--text-muted)',
                marginBottom: 4,
                display: 'block',
                textAlign: 'left',
                letterSpacing: '0.02em',
              }}>
                {t('设置密码（至少 12 个字符）')}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('输入密码')}
                  value={password}
                  maxLength={256}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                  onKeyDown={handleKeyDown}
                  autoFocus
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
                </button>
              </div>
            </div>

            <div>
              <label style={{
                fontSize: '12px',
                color: 'var(--text-muted)',
                marginBottom: 4,
                display: 'block',
                textAlign: 'left',
                letterSpacing: '0.02em',
              }}>
                {t('确认密码')}
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder={t('再次输入密码')}
                value={confirmPassword}
                maxLength={256}
                onChange={(e) => { setConfirmPassword(e.target.value); setError('') }}
                onKeyDown={handleKeyDown}
              />
            </div>

            {error && <div className="error-msg">{error}</div>}

            {/* Password strength indicator */}
            {password.length > 0 && (
              <div style={{
                fontSize: '12px',
                marginTop: 6,
                color: Array.from(password).length >= 12
                  ? (Array.from(password).length >= 16 ? 'var(--success)' : 'var(--accent)')
                  : 'var(--error)',
              }}>
                {t('密码强度: {strength}', { strength: Array.from(password).length < 12
                  ? t('太短')
                  : Array.from(password).length < 16
                    ? t('一般')
                    : t('较强') })}
              </div>
            )}
          </div>

          <button onClick={handleSetup} disabled={loading}>
            {loading ? t('初始化中...') : t('创建加密仓库')}
          </button>

          {/* Info box — Apple-style tip card */}
          <div style={{
            marginTop: 20,
            padding: '14px 16px',
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-lg)',
            fontSize: '12px',
            color: 'var(--text-muted)',
            textAlign: 'left',
            lineHeight: 1.7,
            border: '0.5px solid var(--border)',
          }}>
            <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>
              {t('关于加密')}
            </div>
            <ul style={{ paddingLeft: 16, margin: 0 }}>
              <li>{t('所有笔记、图片均使用 AES-256-GCM 加密存储')}</li>
              <li>{t('密码通过 PBKDF2 派生密钥，安全可靠')}</li>
              <li>{t('关闭软件后密码自动清除，下次需重新输入')}</li>
              <li>{t('可在设置中随时修改密码和数据存储位置')}</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  // ====== Normal Unlock Mode ======
  return (
    <div className="password-overlay">
      <div className="password-dialog">
        {languageToggle}
        <div className="auth-brand-lockup">
          <DefaultAvatar alt="arkNote" size={72} />
          <span className="auth-brand-badge" aria-hidden="true">
            <KeyRound size={15} strokeWidth={2} />
          </span>
        </div>

        <h1>arkNote</h1>
        <p>{restored ? t('数据恢复完成，请输入原仓库密码解锁') : t('请输入密码解锁您的笔记')}</p>

        <div className="input-group">
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder={t('输入密码')}
              value={password}
              maxLength={256}
              onChange={(e) => { setPassword(e.target.value); setError('') }}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
            </button>
          </div>

          {error && <div className="error-msg">{error}</div>}
        </div>

        <button onClick={handleUnlock} disabled={loading || cooldownSeconds > 0}>
          {loading ? t('解锁中...') : cooldownSeconds > 0 ? t('{seconds} 秒后重试', { seconds: cooldownSeconds }) : t('解锁')}
        </button>
      </div>
    </div>
  )
}
