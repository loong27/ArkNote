import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import { Copy, Check } from 'lucide-react'
import { useI18n } from '../../i18n/I18nProvider'

interface Props {
  x: number
  y: number
  onCopy: () => Promise<boolean> | boolean
  onClose: () => void
}

export const ImageContextMenu: React.FC<Props> = ({ x, y, onCopy, onClose }) => {
  const { t } = useI18n()
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed' | 'loading'>('idle')

  useLayoutEffect(() => {
    const el = menuRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const pad = 8
    let left = x
    let top = y
    if (left + rect.width > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - rect.width - pad)
    }
    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - rect.height - pad)
    }
    setPos({ left, top })
  }, [x, y])

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const handleCopy = async () => {
    if (copyState === 'loading' || copyState === 'copied') return
    setCopyState('loading')
    try {
      const ok = await onCopy()
      setCopyState(ok ? 'copied' : 'failed')
      if (ok) {
        setTimeout(() => onClose(), 600)
      } else {
        setTimeout(() => setCopyState('idle'), 1600)
      }
    } catch {
      setCopyState('failed')
      setTimeout(() => setCopyState('idle'), 1600)
    }
  }

  const label =
    copyState === 'copied'
      ? t('已复制')
      : copyState === 'failed'
        ? t('复制失败')
        : t('复制图片')

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      className="note-menu-dropdown image-context-menu"
      style={{ left: pos.left, top: pos.top }}
      role="menu"
    >
      <button
        type="button"
        className={`note-menu-item${copyState === 'copied' ? ' is-success' : ''}`}
        onClick={() => void handleCopy()}
        disabled={copyState === 'loading' || copyState === 'copied'}
        role="menuitem"
      >
        {copyState === 'copied' ? (
          <Check size={14} strokeWidth={2} />
        ) : (
          <Copy size={14} strokeWidth={2} />
        )}
        <span>{label}</span>
      </button>
    </div>,
    document.body
  )
}
