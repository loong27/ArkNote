import React, { useEffect, useRef, useState } from 'react'
import {
  clearSshPrivateKey,
  loadSyncConfig,
  saveSshPrivateKey,
  saveSyncConfig,
  type MobileSyncConfig,
} from '../lib/syncConfig'
import { runSyncPull, testSyncConnection } from '../lib/syncPull'

interface Props {
  onBack: () => void
  /** Called after a successful pull that locked the session */
  onSyncLocked?: () => void
}

export const SyncSettingsPage: React.FC<Props> = ({ onBack, onSyncLocked }) => {
  const [config, setConfig] = useState<MobileSyncConfig | null>(null)
  const [repoUrl, setRepoUrl] = useState('')
  const [branch, setBranch] = useState('main')
  const [httpsToken, setHttpsToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [sshPem, setSshPem] = useState('')
  const [sshPassphrase, setSshPassphrase] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const keyFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void loadSyncConfig().then((c) => {
      setConfig(c)
      setRepoUrl(c.repoUrl)
      setBranch(c.branch || 'main')
      setHttpsToken(c.httpsToken)
      setSshPassphrase(c.sshPassphrase)
    })
  }, [])

  const persistBasics = async () => {
    const next = await saveSyncConfig({
      enabled: true,
      repoUrl,
      branch,
      httpsToken,
    })
    setConfig(next)
    return next
  }

  const onImportKeyFile = async (list: FileList | null) => {
    setError('')
    if (!list?.[0]) return
    try {
      const text = await list[0].text()
      setSshPem(text)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const saveKey = async () => {
    setError('')
    setStatus('')
    try {
      if (!sshPem.trim()) {
        setError('请先粘贴或选择私钥文件')
        return
      }
      const next = await saveSshPrivateKey(sshPem, sshPassphrase)
      setConfig(next)
      setSshPem('')
      setStatus('SSH 私钥已保存到本机沙箱')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const removeKey = async () => {
    setError('')
    const next = await clearSshPrivateKey()
    setConfig(next)
    setSshPassphrase('')
    setStatus('已清除 SSH 私钥')
  }

  const onTest = async () => {
    setBusy(true)
    setError('')
    setStatus('')
    try {
      await persistBasics()
      const result = await testSyncConnection()
      if (result.success) setStatus(result.message)
      else setError(result.message)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const onSync = async () => {
    setBusy(true)
    setError('')
    setStatus('')
    try {
      await persistBasics()
      const result = await runSyncPull()
      const refreshed = await loadSyncConfig()
      setConfig(refreshed)
      if (result.success) {
        setStatus(result.message)
        if (result.lockedSession) onSyncLocked?.()
      } else {
        setError(result.message)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <button className="icon-btn" onClick={onBack} type="button">返回</button>
        <h2>Git 同步</h2>
      </div>

      <div className="card">
        <p className="hint" style={{ marginTop: 0 }}>
          单向同步：仅从云端拉取到本机，不会上传或修改远程仓库。SSH 地址走私钥；HTTPS 地址走 Token。
        </p>

        <div className="field">
          <label htmlFor="repoUrl">仓库地址（HTTPS 或 SSH）</label>
          <input
            id="repoUrl"
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/org/vault.git 或 git@github.com:org/vault.git"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        <div className="field">
          <label htmlFor="branch">分支</label>
          <input
            id="branch"
            type="text"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="main"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>

        <div className="field">
          <label htmlFor="token">HTTPS Token（私有库）</label>
          <input
            id="token"
            type={showToken ? 'text' : 'password'}
            value={httpsToken}
            onChange={(e) => setHttpsToken(e.target.value)}
            placeholder="GitHub PAT / 访问令牌"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <button className="btn" type="button" style={{ marginTop: 8 }} onClick={() => setShowToken((v) => !v)}>
            {showToken ? '隐藏 Token' : '显示 Token'}
          </button>
        </div>

        <hr className="sep" />

        <div className="field">
          <label>SSH 私钥</label>
          <p className="hint" style={{ marginTop: 0 }}>
            {config?.hasSshKey ? '已保存私钥（Deploy Key 只读即可）' : '尚未导入私钥'}
          </p>
          <textarea
            className="pem-input"
            rows={5}
            value={sshPem}
            onChange={(e) => setSshPem(e.target.value)}
            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
            spellCheck={false}
          />
          <label className="file-pick" style={{ marginTop: 8 }}>
            <input
              ref={keyFileRef}
              type="file"
              accept=".pem,.key,text/plain,*/*"
              onChange={(e) => void onImportKeyFile(e.target.files)}
            />
          </label>
          <div className="field" style={{ marginTop: 8 }}>
            <label htmlFor="sshPass">私钥密码（可选）</label>
            <input
              id="sshPass"
              type="password"
              value={sshPassphrase}
              onChange={(e) => setSshPassphrase(e.target.value)}
              placeholder="若私钥有口令则填写"
            />
          </div>
          <div className="btn-row">
            <button className="btn" type="button" disabled={busy} onClick={() => void saveKey()}>保存私钥</button>
            <button className="btn" type="button" disabled={busy || !config?.hasSshKey} onClick={() => void removeKey()}>
              清除私钥
            </button>
          </div>
        </div>

        {config?.lastSyncAt && (
          <p className="hint">上次同步：{new Date(config.lastSyncAt).toLocaleString()}</p>
        )}
        {status && <p className="hint ok">{status}</p>}
        {error && <p className="error">{error}</p>}

        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn" type="button" disabled={busy} onClick={() => void onTest()}>
            {busy ? '请稍候…' : '测试连接'}
          </button>
          <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void onSync()}>
            {busy ? '同步中…' : '立即同步'}
          </button>
        </div>
      </div>
    </div>
  )
}
