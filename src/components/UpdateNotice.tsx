import React, { useEffect, useState } from 'react'
import { Download, RefreshCw, RotateCcw, X } from 'lucide-react'
import type { AppUpdateState } from '../types'
import { useI18n } from '../i18n/I18nProvider'

export const UpdateNotice: React.FC = () => {
  const { t } = useI18n()
  const [state, setState] = useState<AppUpdateState | null>(null)
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null)

  useEffect(() => {
    let disposed = false
    window.electronAPI.updates.getState()
      .then((nextState) => {
        if (!disposed) setState(nextState)
      })
      .catch(console.error)

    const unsubscribe = window.electronAPI.updates.onStateChanged((nextState) => {
      if (!disposed) setState(nextState)
    })
    return () => {
      disposed = true
      unsubscribe()
    }
  }, [])

  if (!state) return null
  if (!['available', 'downloading', 'downloaded'].includes(state.phase)) return null
  if (state.availableVersion && dismissedVersion === state.availableVersion) return null

  const handleAction = async () => {
    if (state.phase === 'available') {
      setState(await window.electronAPI.updates.download())
    } else if (state.phase === 'downloaded') {
      await window.electronAPI.updates.install()
    }
  }

  return (
    <aside className="update-notice" aria-live="polite">
      <div className="update-notice-icon" aria-hidden="true">
        {state.phase === 'downloaded'
          ? <RotateCcw size={18} strokeWidth={1.8} />
          : state.phase === 'downloading'
            ? <RefreshCw className="spin" size={18} strokeWidth={1.8} />
            : <Download size={18} strokeWidth={1.8} />}
      </div>
      <div className="update-notice-copy">
        <strong>{state.phase === 'downloaded' ? t('更新已就绪') : t('arkNote 有新版本')}</strong>
        <span>{t(state.message)}</span>
        {state.phase === 'downloading' && (
          <div className="update-progress" aria-label={t('下载进度 {progress}%', { progress: Math.round(state.progress ?? 0) })}>
            <span style={{ width: `${state.progress ?? 0}%` }} />
          </div>
        )}
      </div>
      {state.phase !== 'downloading' && (
        <button className="update-notice-action" type="button" onClick={handleAction}>
          {state.phase === 'downloaded' ? t('重启安装') : t('下载')}
        </button>
      )}
      <button
        className="update-notice-dismiss"
        type="button"
        onClick={() => setDismissedVersion(state.availableVersion)}
        title={t('暂时关闭')}
      >
        <X size={15} strokeWidth={1.8} />
      </button>
    </aside>
  )
}
