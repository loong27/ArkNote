import React, { useState, useEffect, useCallback, useRef } from 'react'
import { X, ChevronUp, ChevronDown, Search } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { SearchMatch } from '../../types'

interface Props {
  onHighlight: (matches: SearchMatch[], currentIndex: number) => void
}

export const SearchInNote: React.FC<Props> = ({ onHighlight }) => {
  const {
    currentNote,
    noteSearchQuery,
    noteSearchVisible,
    setNoteSearchQuery,
    setNoteSearchVisible,
  } = useStore()

  const [matches, setMatches] = useState<SearchMatch[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when search becomes visible
  useEffect(() => {
    if (noteSearchVisible && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [noteSearchVisible])

  // Search when query changes
  useEffect(() => {
    if (!noteSearchQuery.trim() || !currentNote) {
      setMatches([])
      setCurrentIndex(0)
      onHighlight([], 0)
      return
    }

    const search = async () => {
      try {
        const results = await window.electronAPI.search.inNote(currentNote.id, noteSearchQuery)
        setMatches(results)
        setCurrentIndex(results.length > 0 ? 0 : -1)
        onHighlight(results, 0)
      } catch (error) {
        console.error('Search in note failed:', error)
      }
    }

    const timer = setTimeout(search, 200)
    return () => clearTimeout(timer)
  }, [noteSearchQuery, currentNote])

  const handleNext = useCallback(() => {
    if (matches.length === 0) return
    const nextIndex = (currentIndex + 1) % matches.length
    setCurrentIndex(nextIndex)
    onHighlight(matches, nextIndex)
  }, [matches, currentIndex, onHighlight])

  const handlePrev = useCallback(() => {
    if (matches.length === 0) return
    const prevIndex = (currentIndex - 1 + matches.length) % matches.length
    setCurrentIndex(prevIndex)
    onHighlight(matches, prevIndex)
  }, [matches, currentIndex, onHighlight])

  const handleClose = () => {
    setNoteSearchVisible(false)
    setNoteSearchQuery('')
    setMatches([])
    onHighlight([], 0)
  }

  // Handle keyboard shortcuts within the search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && noteSearchVisible) {
        handleClose()
      }
      if (e.key === 'Enter' && noteSearchVisible) {
        if (e.shiftKey) {
          handlePrev()
        } else {
          handleNext()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [noteSearchVisible, handleNext, handlePrev])

  if (!noteSearchVisible) return null

  return (
    <div className="note-search-floating">
      <div className="note-search-icon">
        <Search size={14} strokeWidth={1.5} />
      </div>
      <input
        ref={inputRef}
        type="text"
        value={noteSearchQuery}
        onChange={(e) => setNoteSearchQuery(e.target.value)}
        placeholder="在笔记中搜索..."
        className="note-search-input"
      />
      <span className="note-search-count">
        {matches.length > 0
          ? `${currentIndex + 1} / ${matches.length}`
          : noteSearchQuery ? '0 / 0' : ''
        }
      </span>
      <div className="note-search-actions">
        <button className="note-search-btn" onClick={handlePrev} disabled={matches.length === 0} title="上一个 (Shift+Enter)">
          <ChevronUp size={16} strokeWidth={1.5} />
        </button>
        <button className="note-search-btn" onClick={handleNext} disabled={matches.length === 0} title="下一个 (Enter)">
          <ChevronDown size={16} strokeWidth={1.5} />
        </button>
        <button className="note-search-btn" onClick={handleClose} title="关闭 (Esc)">
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}
