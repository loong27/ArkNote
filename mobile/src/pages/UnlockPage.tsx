import React, { useRef, useState } from 'react'
import { filesFromFileList, validateVaultFiles } from '../lib/importVault'
import { unlockFromFiles } from '../lib/session'

interface Props {
  onUnlocked: () => void
}

export const UnlockPage: React.FC<Props> = ({ onUnlocked }) => {
  const [password, setPassword] = useState('')
  const [fileLabel, setFileLabel] = useState('尚未选择仓库文件')
  const [files, setFiles] = useState<Map<string, Uint8Array> | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const zipRef = useRef<HTMLInputElement>(null)
  const dirRef = useRef<HTMLInputElement>(null)

  const onPick = async (list: FileList | null) => {
    setError('')
    if (!list || list.length === 0) return
    try {
      const map = await filesFromFileList(list)
      validateVaultFiles(map)
      setFiles(map)
      setFileLabel(`已载入 ${map.size} 个文件`)
    } catch (e) {
      setFiles(null)
      setFileLabel('尚未选择仓库文件')
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const unlock = async () => {
    setError('')
    if (!files) {
      setError('请先导入加密备份 zip，或选择含 salt.bin 的仓库目录')
      return
    }
    if (!password) {
      setError('请输入密码')
      return
    }
    setLoading(true)
    try {
      await unlockFromFiles(files, password)
      onUnlocked()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-shell">
      <div className="brand">
        <h1>arkNote Reader</h1>
        <p>只读解锁本地加密仓库。不编辑、不同步、无账号。</p>
      </div>

      <div className="card">
        <label className="file-pick">
          <span className="field"><label>导入加密备份（zip）</label></span>
          <input
            ref={zipRef}
            type="file"
            accept=".zip,application/zip"
            onChange={(e) => void onPick(e.target.files)}
          />
        </label>

        <label className="file-pick">
          <span className="field"><label>或选择仓库目录</label></span>
          <input
            ref={dirRef}
            type="file"
            // @ts-expect-error webkitdirectory is non-standard but widely supported
            webkitdirectory=""
            multiple
            onChange={(e) => void onPick(e.target.files)}
          />
        </label>

        <p className="hint" style={{ marginTop: 0 }}>{fileLabel}</p>

        <div className="field">
          <label htmlFor="password">仓库密码</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void unlock()
            }}
            placeholder="至少用于解锁的同一密码"
          />
        </div>

        {error && <p className="error">{error}</p>}

        <button className="btn btn-primary" disabled={loading} onClick={() => void unlock()}>
          {loading ? '解锁中…' : '解锁只读'}
        </button>

        <p className="hint">
          在桌面端「设置 → 备份」导出加密备份，拷到手机后在此导入。密码无法找回。
        </p>
      </div>
    </div>
  )
}
