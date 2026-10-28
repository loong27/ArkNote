import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { X, Download, Copy, Check, RefreshCw, Image as ImageIcon } from 'lucide-react'
import { useI18n } from '../../i18n/I18nProvider'
import { copyImageToClipboard } from '../../utils/copyImage'

interface Props {
  open: boolean
  noteId: string
  title: string
  htmlContent: string
  onClose: () => void
}

type Phase = 'loading' | 'ready' | 'error'

export const ShareImageDialog: React.FC<Props> = ({
  open,
  noteId,
  title,
  htmlContent,
  onClose,
}) => {
  const { t } = useI18n()
  const [phase, setPhase] = useState<Phase>('loading')
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [saving, setSaving] = useState(false)

  const generate = async () => {
    setPhase('loading')
    setError('')
    setDataUrl(null)
    try {
      const result = await window.electronAPI.notes.renderShareImage(noteId, htmlContent, title)
      if (!result?.success || !result.dataUrl) {
        throw new Error(result?.message || t('长图生成失败'))
      }
      setDataUrl(result.dataUrl)
      setPhase('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setPhase('error')
    }
  }

  useEffect(() => {
    if (!open) return
    setCopyState('idle')
    void generate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, noteId, htmlContent, title])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const handleCopy = async () => {
    if (!dataUrl) return
    const ok = await copyImageToClipboard(dataUrl)
    setCopyState(ok ? 'copied' : 'failed')
    window.setTimeout(() => setCopyState('idle'), 1600)
  }

  const handleSave = async () => {
    if (!dataUrl) return
    setSaving(true)
    try {
      await window.electronAPI.notes.saveShareImage(dataUrl, title)
    } finally {
      setSaving(false)
    }
  }

  return ReactDOM.createPortal(
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog share-image-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>{t('导出长图')}</h3>
          <button className="icon-btn" onClick={onClose} aria-label={t('关闭')}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="dialog-body share-image-dialog-body">
          {phase === 'loading' && (
            <div className="share-image-status">
              <RefreshCw size={22} strokeWidth={1.6} className="share-image-spin" />
              <p>{t('生成长图中...')}</p>
            </div>
          )}

          {phase === 'error' && (
            <div className="share-image-status">
              <ImageIcon size={22} strokeWidth={1.6} />
              <p>{error || t('长图生成失败')}</p>
              <button className="btn btn-primary" onClick={() => void generate()}>
                {t('重试')}
              </button>
            </div>
          )}

          {phase === 'ready' && dataUrl && (
            <div className="share-image-preview-wrap">
              <img className="share-image-preview" src={dataUrl} alt={title} draggable={false} />
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button className="btn" onClick={onClose}>{t('关闭')}</button>
          <button
            className="btn"
            disabled={phase !== 'ready' || !dataUrl}
            onClick={() => void handleCopy()}
          >
            {copyState === 'copied' ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.6} />}
            <span>
              {copyState === 'copied' ? t('已复制') : copyState === 'failed' ? t('复制失败') : t('复制图片')}
            </span>
          </button>
          <button
            className="btn btn-primary"
            disabled={phase !== 'ready' || !dataUrl || saving}
            onClick={() => void handleSave()}
          >
            <Download size={14} strokeWidth={1.6} />
            <span>{t('保存图片')}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
