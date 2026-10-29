import React from 'react'
import { ShieldAlert } from 'lucide-react'
import { useI18n } from '../../i18n/I18nProvider'

interface Props {
  open: boolean
  onClose: () => void
}

export const RecoveryTipDialog: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useI18n()
  if (!open) return null

  const dismiss = async () => {
    await window.electronAPI.vault.dismissRecoveryTip?.()
    onClose()
  }

  return (
    <div className="dialog-overlay">
      <div className="dialog" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldAlert size={18} />
            {t('请妥善保管密码')}
          </h3>
        </div>
        <div className="dialog-body" style={{ lineHeight: 1.7, fontSize: 14, color: 'var(--text-secondary)' }}>
          <p>{t('arkNote 没有密码找回通道。丢失密码意味着无法恢复数据。')}</p>
          <ul style={{ paddingLeft: 18, marginTop: 12 }}>
            <li>{t('把密码存入密码管理器')}</li>
            <li>{t('在设置 → 备份 中导出加密仓库到 U 盘')}</li>
            <li>{t('定期验证仓库完整性')}</li>
          </ul>
        </div>
        <div className="dialog-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: 16 }}>
          <button className="btn btn-primary" onClick={() => void dismiss()}>{t('我已了解')}</button>
        </div>
      </div>
    </div>
  )
}
