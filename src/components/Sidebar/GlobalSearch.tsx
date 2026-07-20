import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { Search, Filter, X, ChevronRight, Folder, Check } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { SearchResult } from '../../types'
import { useI18n } from '../../i18n/I18nProvider'

const GLOBAL_SEARCH_TOTAL_LIMIT = 20

export const GlobalSearch: React.FC = () => {
  const { t } = useI18n()
  const {
    directories,
    globalSearchQuery,
    globalSearchResults,
    globalSearchDirIds,
    setGlobalSearchQuery,
    setGlobalSearchResults,
    setGlobalSearchDirIds,
    openNote,
  } = useStore()

  const [showFilters, setShowFilters] = useState(false)
  const [searching, setSearching] = useState(false)

  // Debounced search
  useEffect(() => {
    let cancelled = false

    if (!globalSearchQuery.trim()) {
      setSearching(false)
      setGlobalSearchResults([])
      return () => { cancelled = true }
    }

    const timer = setTimeout(async () => {
      if (cancelled) return
      setSearching(true)
      try {
        const results = await window.electronAPI.search.global(
          globalSearchQuery,
          globalSearchDirIds.length > 0 ? globalSearchDirIds : undefined,
          GLOBAL_SEARCH_TOTAL_LIMIT
        )
        if (!cancelled) {
          setGlobalSearchResults(results)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Search failed:', error)
        }
      }
      if (!cancelled) {
        setSearching(false)
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [globalSearchQuery, globalSearchDirIds, setGlobalSearchResults])

  const toggleDirFilter = useCallback((dirId: string) => {
    const current = [...globalSearchDirIds]
    const idx = current.indexOf(dirId)
    if (idx !== -1) {
      current.splice(idx, 1)
    } else {
      current.push(dirId)
    }
    setGlobalSearchDirIds(current)
  }, [globalSearchDirIds, setGlobalSearchDirIds])

  // Root directories for filter
  const rootDirs = useMemo(
    () => directories.filter(d => d.parentId === null),
    [directories]
  )

  const handleResultClick = (result: SearchResult) => {
    openNote(result.noteId)
  }

  return (
    <div className="global-search">
      <div className="search-bar">
        <div className="search-wrapper">
          <Search size={14} strokeWidth={1.5} className="search-icon" />
          <input
            type="text"
            value={globalSearchQuery}
            onChange={(e) => setGlobalSearchQuery(e.target.value)}
            placeholder={t('在所有笔记中搜索...')}
          />
        </div>
      </div>

      {/* Filter toggle */}
      <div className="global-search-filters" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>
          {globalSearchDirIds.length > 0
            ? t('在 {count} 个目录中搜索', { count: globalSearchDirIds.length })
            : t('在所有笔记中搜索')}
        </span>
        <button
          className="icon-btn sm"
          onClick={() => setShowFilters(!showFilters)}
          data-tooltip={t('选择搜索范围')}
        >
          <Filter size={14} strokeWidth={1.5} />
        </button>
      </div>

      {/* Directory filter panel */}
      {showFilters && (
        <div style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border)',
          maxHeight: '200px',
          overflowY: 'auto',
        }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            {t('选择搜索范围 (不选则搜索全部)')}
            {globalSearchDirIds.length > 0 && (
              <button
                className="icon-btn sm"
                onClick={() => setGlobalSearchDirIds([])}
                style={{ marginLeft: 8, display: 'inline-flex' }}
              >
                <X size={12} strokeWidth={1.5} />
              </button>
            )}
          </div>

          {rootDirs.map(dir => (
            <div
              key={dir.id}
              className="move-tree-item"
              style={{
                '--indent-level': 0,
                padding: '4px 8px',
                fontSize: '13px',
              } as React.CSSProperties}
              onClick={() => toggleDirFilter(dir.id)}
            >
              {globalSearchDirIds.includes(dir.id) ? (
                <Check size={14} strokeWidth={1.5} color="var(--accent)" />
              ) : (
                <Folder size={14} strokeWidth={1.5} />
              )}
              <span>{dir.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Search results */}
      <div className="global-search-results">
        {searching && (
          <div className="empty-state">
            <p>{t('搜索中...')}</p>
          </div>
        )}

        {!searching && globalSearchQuery && globalSearchResults.length === 0 && (
          <div className="empty-state">
            <Search size={32} strokeWidth={1.5} />
            <p>{t('未找到匹配结果')}</p>
          </div>
        )}

        {!searching && globalSearchResults.map((result) => (
          <div
            key={result.noteId}
            className="search-result-item"
            onClick={() => handleResultClick(result)}
          >
            <div className="search-result-title">{result.noteTitle}</div>
            <div className="search-result-path">{t(result.directoryPath)}</div>
            {result.matches.slice(0, 3).map((match, i) => (
              <div key={i} className="search-result-match">
                {t('第 {line} 行: {context}', { line: match.line, context: t(match.context.substring(0, 100)) })}
              </div>
            ))}
            {result.matches.length > 3 && (
              <div className="search-result-match" style={{ color: 'var(--text-muted)' }}>
                {t('...还有 {count} 处匹配', { count: result.matches.length - 3 })}
              </div>
            )}
          </div>
        ))}

        {!globalSearchQuery && (
          <div className="empty-state">
            <Search size={32} strokeWidth={1.5} />
            <p>{t('输入关键词搜索所有笔记')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
