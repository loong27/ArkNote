import React, { useState } from 'react'
import { User } from 'lucide-react'

interface DefaultAvatarProps {
  alt?: string
  className?: string
  size?: number
  style?: React.CSSProperties
}

const DEFAULT_AVATAR_SRC = new URL('./icon.png', document.baseURI).href

export const DefaultAvatar: React.FC<DefaultAvatarProps> = ({
  alt = '默认头像',
  className,
  size,
  style,
}) => {
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
        aria-label={alt}
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
      alt={alt}
      style={mergedStyle}
      draggable={false}
      onError={() => setLoadFailed(true)}
    />
  )
}
