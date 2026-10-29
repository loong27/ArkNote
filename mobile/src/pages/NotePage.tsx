import React, { useEffect, useState } from 'react'
import { getReader } from '../lib/session'
import { renderReadOnlyMarkdown } from '../lib/markdown'

interface Props {
  noteId: string
  title: string
  onBack: () => void
}

export const NotePage: React.FC<Props> = ({ noteId, title, onBack }) => {
  const [html, setHtml] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void getReader().getNoteContent(noteId).then((content) => {
      if (!cancelled) setHtml(renderReadOnlyMarkdown(content))
    }).catch((e) => {
      if (!cancelled) setError(e instanceof Error ? e.message : String(e))
    })
    return () => { cancelled = true }
  }, [noteId])

  return (
    <div className="app-shell">
      <div className="topbar">
        <button className="icon-btn" onClick={onBack}>返回</button>
        <h2>{title || '未命名笔记'}</h2>
      </div>
      <div className="card">
        {error && <p className="error">{error}</p>}
        {!error && !html && <p className="hint">加载中…</p>}
        {!error && html && (
          <div className="markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </div>
    </div>
  )
}
