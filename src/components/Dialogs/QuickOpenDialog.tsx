import React, { useEffect, useMemo, useState } from 'react'
import { Search, FileText } from 'lucide-react'
import type { NoteMetadata } from '../../types'
import { useStore } from '../../store/useStore'
import { useI18n } from '../../i18n/I18nProvider'

interface Props {
  open: boolean
  onClose: () => void
}

export const QuickOpenDialog: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useI18n()
  const openNote = useStore(s => s.openNote)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NoteMetadata[]>([])
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setIndex(0)
    void window.electronAPI.search.byTitle('', 20).then(setResults)
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void window.electronAPI.search.byTitle(query, 30).then((items) => {
        if (!cancelled) {
          setResults(items)
          setIndex(0)
        }
      })
    }, 120)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, open])

  const visible = useMemo(() => results.slice(0, 30), [results])

  if (!open) return null

  const choose = async (note: NoteMetadata) => {
    await window.electronAPI.notesExtras.touchRecent(note.id)
    await openNote(note.id)
    onClose()
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog"
        style={{ width: 520, marginTop: '12vh', alignSelf: 'flex-start' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '0.5px solid var(--border)' }}>
          <Search size={16} strokeWidth={1.6} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('按标题快速打开笔记…')}
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              color: 'var(--text-primary)', fontSize: 15,
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setIndex(i => Math.min(visible.length - 1, i + 1))
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setIndex(i => Math.max(0, i - 1))
              }
              if (e.key === 'Enter' && visible[index]) {
                e.preventDefault()
                void choose(visible[index])
              }
            }}
          />
        </div>
        <div style={{ maxHeight: 360, overflow: 'auto', padding: 8 }}>
          {visible.length === 0 && (
            <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>{t('没有匹配的笔记')}</div>
          )}
          {visible.map((note, i) => (
            <button
              key={note.id}
              className="btn"
              onClick={() => void choose(note)}
              style={{
                width: '100%', justifyContent: 'flex-start', gap: 8, marginBottom: 4,
                background: i === index ? 'var(--bg-hover)' : 'transparent',
              }}
            >
              <FileText size={14} strokeWidth={1.5} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {note.title || t('未命名笔记')}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
