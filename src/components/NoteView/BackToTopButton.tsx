import React, { useCallback, useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { useI18n } from '../../i18n/I18nProvider'

interface Props {
  scrollRef: React.RefObject<HTMLElement | null>
  enabled: boolean
  /** Re-evaluate visibility when note / content context changes */
  resetKey?: string
}

export const BackToTopButton: React.FC<Props> = ({ scrollRef, enabled, resetKey }) => {
  const { t } = useI18n()
  const [visible, setVisible] = useState(false)

  const updateVisibility = useCallback(() => {
    const el = scrollRef.current
    if (!el || !enabled) {
      setVisible(false)
      return
    }
    setVisible(el.scrollTop > el.clientHeight)
  }, [enabled, scrollRef])

  useEffect(() => {
    if (!enabled) {
      setVisible(false)
      return
    }

    const el = scrollRef.current
    if (!el) {
      setVisible(false)
      return
    }

    updateVisibility()
    el.addEventListener('scroll', updateVisibility, { passive: true })

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => updateVisibility())
      : null
    resizeObserver?.observe(el)

    window.addEventListener('resize', updateVisibility)

    return () => {
      el.removeEventListener('scroll', updateVisibility)
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updateVisibility)
    }
  }, [enabled, resetKey, scrollRef, updateVisibility])

  const handleClick = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [scrollRef])

  if (!enabled) return null

  return (
    <button
      type="button"
      className={`back-to-top-btn${visible ? ' is-visible' : ''}`}
      onClick={handleClick}
      aria-label={t('返回顶部')}
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
    >
      <ArrowUp size={18} strokeWidth={1.75} />
    </button>
  )
}
