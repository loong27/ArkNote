import React, { useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import { AlertTriangle } from 'lucide-react'
import { useI18n } from '../../i18n/I18nProvider'

interface Props {
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Apple HIG Confirm Dialog — Sheet style with glassmorphism.
 * Uses spring animation, retina borders, and gradient buttons.
 */
export const ConfirmDialog: React.FC<Props> = ({
  open,
  title,
  message,
  confirmText,
  cancelText,
  danger = false,
  onConfirm,
  onCancel,
}) => {
  const { t } = useI18n()
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Auto-focus cancel button (default action is cancel)
  useEffect(() => {
    if (open && cancelRef.current) {
      setTimeout(() => cancelRef.current?.focus(), 50)
    }
  }, [open])

  // Escape to cancel
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  if (!open) return null

  // Use portal to render at document body level, avoiding backdrop-filter
  // containment from sidebar that would clip position:fixed dialogs
  return ReactDOM.createPortal(
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-dialog-content">
          <div className={`confirm-dialog-icon ${danger ? 'danger' : ''}`}>
            <AlertTriangle size={15} strokeWidth={2.2} />
          </div>
          <div className="confirm-dialog-copy">
            <h3>{title}</h3>
            <p>{message}</p>
          </div>
        </div>
        <div className="confirm-dialog-actions">
          <button
            ref={cancelRef}
            className="btn"
            onClick={onCancel}
          >
            {cancelText ?? t('取消')}
          </button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmText ?? t('确认')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
