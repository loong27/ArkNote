import React, { useState } from 'react'
import { User } from 'lucide-react'
import { useI18n } from '../../i18n/I18nProvider'

interface DefaultAvatarProps {
  alt?: string
  className?: string
  size?: number
  style?: React.CSSProperties
}

const DEFAULT_AVATAR_SRC = new URL('./default-avatar.png', document.baseURI).href

export const DefaultAvatar: React.FC<DefaultAvatarProps> = ({
  alt,
  className,
  size,
  style,
}) => {
  const { t } = useI18n()
  const resolvedAlt = alt ?? t('默认头像')
  const [loadFailed, setLoadFailed] = useState(false)
  const classNames = ['default-avatar', className].filter(Boolean).join(' ')
  const sizeStyle = size ? { width: size, height: size } : undefined
  const mergedStyle = { ...sizeStyle, ...style }
  const iconSize = Math.max(12, Math.round((size ?? 24) * 0.62))

  if (loadFailed) {
    return (
      <span
        className={`${classNames} default-avatar-fallback`}
        role="img"
        aria-label={resolvedAlt}
        style={mergedStyle}
      >
        <User size={iconSize} strokeWidth={1.8} />
      </span>
    )
  }

  return (
    <img
      className={classNames}
      src={DEFAULT_AVATAR_SRC}
      alt={resolvedAlt}
      style={mergedStyle}
      draggable={false}
      onError={() => setLoadFailed(true)}
    />
  )
}
