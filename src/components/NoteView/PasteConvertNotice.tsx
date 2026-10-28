import React, { useEffect } from 'react'
import { FileCode2, X } from 'lucide-react'
import { useI18n } from '../../i18n/I18nProvider'

const AUTO_DISMISS_MS = 12_000

interface Props {
  onConvert: () => void
  onDismiss: () => void
}

export const PasteConvertNotice: React.FC<Props> = ({ onConvert, onDismiss }) => {
  const { t } = useI18n()

  useEffect(() => {
    const timer = window.setTimeout(onDismiss, AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [onDismiss])

  return (
    <aside className="paste-convert-notice" aria-live="polite">
      <div className="paste-convert-notice-icon" aria-hidden="true">
        <FileCode2 size={18} strokeWidth={1.8} />
      </div>
      <div className="paste-convert-notice-copy">
        <strong>{t('检测到富文本内容')}</strong>
        <span>{t('可一键转换为 Markdown 格式')}</span>
      </div>
      <button className="paste-convert-notice-action" type="button" onClick={onConvert}>
        {t('转为 Markdown')}
      </button>
      <button
        className="paste-convert-notice-dismiss"
        type="button"
        onClick={onDismiss}
        title={t('保持原样')}
      >
        <X size={15} strokeWidth={1.8} />
      </button>
    </aside>
  )
}
