import React, { useEffect, useState } from 'react'
import { X, CalendarDays, ChevronLeft } from 'lucide-react'
import { useI18n } from '../../i18n/I18nProvider'
import { useStore } from '../../store/useStore'
import type { TimeCapsuleNote } from '../../types'

interface Props {
  open: boolean
  onClose: () => void
}

type MonthRow = { year: number; month: number; created: number; updated: number }
type Mode = 'created' | 'updated'

export const TimeCapsuleDialog: React.FC<Props> = ({ open, onClose }) => {
  const { t, locale } = useI18n()
  const openNote = useStore(s => s.openNote)
  const [rows, setRows] = useState<MonthRow[]>([])
  const [selected, setSelected] = useState<{ year: number; month: number } | null>(null)
  const [mode, setMode] = useState<Mode>('created')
  const [notes, setNotes] = useState<TimeCapsuleNote[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) {
      setSelected(null)
      setNotes([])
      setMode('created')
      return
    }
    void window.electronAPI.notesExtras.getTimeCapsule().then(setRows)
  }, [open])

  useEffect(() => {
    if (!open || !selected) return
    setLoading(true)
    void window.electronAPI.notesExtras
      .listByMonth({ year: selected.year, month: selected.month, mode })
      .then(setNotes)
      .finally(() => setLoading(false))
  }, [open, selected, mode])

  if (!open) return null

  const openSelectedNote = async (noteId: string) => {
    await openNote(noteId)
    onClose()
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" style={{ width: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {selected ? (
              <button
                className="icon-btn"
                onClick={() => setSelected(null)}
                title={t('返回年月')}
                aria-label={t('返回年月')}
              >
                <ChevronLeft size={18} />
              </button>
            ) : (
              <CalendarDays size={18} />
            )}
            {selected
              ? `${selected.year}-${String(selected.month).padStart(2, '0')}`
              : t('时间胶囊')}
          </h3>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="dialog-body" style={{ maxHeight: 420, overflow: 'auto' }}>
          {!selected && (
            <>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                {t('按年月查看创建与更新节奏，方便多年后重新找到知识。')}
              </p>
              {rows.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('暂无数据')}</div>
              )}
              {rows.map(row => (
                <button
                  key={`${row.year}-${row.month}`}
                  className="btn"
                  onClick={() => setSelected({ year: row.year, month: row.month })}
                  style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    marginBottom: 4,
                    borderBottom: '0.5px solid var(--border)',
                    fontSize: 13,
                    background: 'transparent',
                    borderRadius: 0,
                  }}
                >
                  <span>{row.year}-{String(row.month).padStart(2, '0')}</span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {t('新建 {created} · 更新 {updated}', { created: row.created, updated: row.updated })}
                  </span>
                </button>
              ))}
            </>
          )}

          {selected && (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button
                  className={`btn btn-sm ${mode === 'created' ? 'btn-primary' : ''}`}
                  onClick={() => setMode('created')}
                >
                  {t('按创建')}
                </button>
                <button
                  className={`btn btn-sm ${mode === 'updated' ? 'btn-primary' : ''}`}
                  onClick={() => setMode('updated')}
                >
                  {t('按更新')}
                </button>
              </div>
              {loading && (
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('加载中...')}</div>
              )}
              {!loading && notes.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('该月暂无笔记')}</div>
              )}
              {!loading && notes.map(note => (
                <button
                  key={note.id}
                  className="btn"
                  onClick={() => void openSelectedNote(note.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 4,
                    padding: '10px 12px',
                    marginBottom: 4,
                    borderBottom: '0.5px solid var(--border)',
                    fontSize: 13,
                    background: 'transparent',
                    borderRadius: 0,
                  }}
                >
                  <span>{note.title || t('未命名笔记')}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {mode === 'updated'
                      ? t('更新于 {date}', { date: new Date(note.updatedAt).toLocaleString(locale) })
                      : t('创建于 {date}', { date: new Date(note.createdAt).toLocaleString(locale) })}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
