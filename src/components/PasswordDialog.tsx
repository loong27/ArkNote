import React, { useState, useCallback, useEffect } from 'react'
import { Lock, Eye, EyeOff, Shield, KeyRound } from 'lucide-react'
import { useStore } from '../store/useStore'

type Mode = 'loading' | 'setup' | 'unlock'

/**
 * Password dialog — Apple Authentication Sheet style.
 * Uses glassmorphism surface with inner bezel highlight,
 * Apple "Glow Ring" focus indicators, and gradient buttons.
 */
export const PasswordDialog: React.FC = () => {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<Mode>('loading')

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
        setMode(firstTime ? 'setup' : 'unlock')
      } catch {
        setMode('unlock')
      }
    }
    check()
  }, [setLocked, loadData])

  const handleSetup = useCallback(async () => {
    if (!password) {
      setError('请设置加密密码')
      return
    }
    if (password.length < 6) {
      setError('密码长度至少 6 位')
      return
    }
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
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
        setError('初始化失败，请重试')
      }
    } catch {
      setError('初始化失败，请重试')
    }
    setLoading(false)
  }, [password, confirmPassword, setLocked, loadData])

  const handleUnlock = useCallback(async () => {
    if (!password) {
      setError('请输入密码')
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
        setError('密码错误，请重试')
      }
    } catch {
      setError('解锁失败，请重试')
    }
    setLoading(false)
  }, [password, setLocked, loadData])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (mode === 'setup') {
        handleSetup()
      } else {
        handleUnlock()
      }
    }
  }

  // ====== Loading State ======
  if (mode === 'loading') {
    return (
      <div className="password-overlay">
        <div className="password-dialog" style={{ textAlign: 'center', padding: '60px 40px' }}>
          <Lock size={48} color="var(--accent)" strokeWidth={1.5} />
          <h1 style={{ marginTop: 16 }}>ZZ-Note</h1>
          <p style={{ color: 'var(--text-muted)' }}>正在加载...</p>
        </div>
      </div>
    )
  }

  // ====== First-time Setup Mode ======
  if (mode === 'setup') {
    return (
      <div className="password-overlay">
        <div className="password-dialog">
          {/* Icon circle — Apple-style centered icon */}
          <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'center' }}>
            <div style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'var(--accent-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'inset 0 0 0 0.5px var(--border)',
            }}>
              <Shield size={36} color="var(--accent)" strokeWidth={1.5} />
            </div>
          </div>

          <h1>欢迎使用 ZZ-Note</h1>
          <p style={{ marginBottom: 8, lineHeight: 1.6 }}>
            首次使用需要设置加密密码。此密码用于加密所有本地文件，
            <br />请务必<strong style={{ color: 'var(--warning)' }}>牢记密码</strong>，密码丢失将无法恢复数据。
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
                设置密码（至少 6 位）
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="输入密码"
                  value={password}
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
                确认密码
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="再次输入密码"
                value={confirmPassword}
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
                color: password.length >= 6
                  ? (password.length >= 12 ? 'var(--success)' : 'var(--accent)')
                  : 'var(--error)',
              }}>
                密码强度: {password.length < 6
                  ? '太短'
                  : password.length < 10
                    ? '一般'
                    : password.length < 14
                      ? '较强'
                      : '很强'}
              </div>
            )}
          </div>

          <button onClick={handleSetup} disabled={loading}>
            {loading ? '初始化中...' : '创建加密仓库'}
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
              🔐 关于加密
            </div>
            <ul style={{ paddingLeft: 16, margin: 0 }}>
              <li>所有笔记、图片均使用 AES-256-GCM 加密存储</li>
              <li>密码通过 PBKDF2 派生密钥，安全可靠</li>
              <li>关闭软件后密码自动清除，下次需重新输入</li>
              <li>可在设置中随时修改密码和数据存储位置</li>
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
        {/* Icon circle */}
        <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'center' }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'var(--accent-dim)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'inset 0 0 0 0.5px var(--border)',
          }}>
            <KeyRound size={36} color="var(--accent)" strokeWidth={1.5} />
          </div>
        </div>

        <h1>ZZ-Note</h1>
        <p>请输入密码解锁您的笔记</p>

        <div className="input-group">
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="输入密码"
              value={password}
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

        <button onClick={handleUnlock} disabled={loading}>
          {loading ? '解锁中...' : '解锁'}
        </button>
      </div>
    </div>
  )
}
