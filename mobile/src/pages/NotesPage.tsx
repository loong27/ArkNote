import React, { useEffect, useMemo, useState } from 'react'
import type { VaultNoteMeta, VaultSearchHit } from '@shared/vaultRead'
import { getReader, listNotes, lockVault } from '../lib/session'

interface Props {
  onOpenNote: (noteId: string, title: string) => void
  onLock: () => void
  onOpenSync: () => void
}

export const NotesPage: React.FC<Props> = ({ onOpenNote, onLock, onOpenSync }) => {
  const [notes, setNotes] = useState<VaultNoteMeta[]>([])
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<VaultSearchHit[] | null>(null)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    setNotes(listNotes())
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!query.trim()) {
      setHits(null)
      setSearching(false)
      return
    }
    setSearching(true)
    const timer = window.setTimeout(() => {
      void getReader().search(query, 80).then((result) => {
        if (!cancelled) {
          setHits(result)
          setSearching(false)
        }
      }).catch(() => {
        if (!cancelled) setSearching(false)
      })
    }, 220)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query])

  const visible = useMemo(() => {
    if (hits) {
      return hits.map(h => ({
        id: h.noteId,
        title: h.title,
        subtitle: h.snippet,
      }))
    }
    return notes.map(n => ({
      id: n.id,
      title: n.title || '未命名笔记',
      subtitle: new Date(n.updatedAt).toLocaleString(),
    }))
  }, [hits, notes])

  return (
    <div className="app-shell">
      <div className="topbar">
        <h2>笔记</h2>
        <button className="icon-btn" type="button" onClick={onOpenSync}>
          同步
        </button>
        <button
          className="icon-btn"
          type="button"
          onClick={() => {
            lockVault()
            onLock()
          }}
        >
          锁定
        </button>
      </div>

      <input
        className="search-input"
        type="search"
        placeholder="搜索标题或正文"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {searching && <p className="hint">搜索中…</p>}

      <div className="note-list">
        {visible.length === 0 && (
          <div className="empty">{query ? '没有匹配结果' : '仓库里还没有笔记'}</div>
        )}
        {visible.map(item => (
          <button
            key={item.id}
            className="note-item"
            onClick={() => onOpenNote(item.id, item.title)}
          >
            <strong>{item.title || '未命名笔记'}</strong>
            <span>{item.subtitle}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
