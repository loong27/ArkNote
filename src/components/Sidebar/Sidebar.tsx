import React, { useCallback, useEffect, useState } from 'react'
import {
  CalendarDays,
  FolderTree,
  Pin,
  RefreshCw,
  Search,
  Settings,
  Tag,
  Trash2,
  BookOpen,
  Clock3,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { DirectoryTree } from './DirectoryTree'
import { TagList } from './TagList'
import { RecycleBin } from './RecycleBin'
import { GlobalSearch } from './GlobalSearch'
import { DefaultAvatar } from '../common/DefaultAvatar'
import type { SidebarTab } from '../../types'
import { useI18n } from '../../i18n/I18nProvider'

interface Props {
  onOpenTimeCapsule?: () => void
  onOpenDailyNote?: () => void | Promise<void>
}

export const Sidebar: React.FC<Props> = ({ onOpenTimeCapsule, onOpenDailyNote }) => {
  const { t } = useI18n()
  const { sidebarTab, setSidebarTab, openSettingsDialog, notes, openNote, noteById } = useStore()
  const [trashHasItems, setTrashHasItems] = useState(false)
  const [pinnedIds, setPinnedIds] = useState<string[]>([])
  const [recentIds, setRecentIds] = useState<string[]>([])

  const mainTabs: { id: SidebarTab; icon: React.ReactNode; label: string }[] = [
    { id: 'files', icon: <FolderTree size={18} strokeWidth={1.6} />, label: t('全部笔记') },
    { id: 'search', icon: <Search size={18} strokeWidth={1.6} />, label: t('搜索') },
    { id: 'tags', icon: <Tag size={18} strokeWidth={1.6} />, label: t('标签') },
    { id: 'trash', icon: <Trash2 size={18} strokeWidth={1.6} />, label: t('回收站') },
  ]

  const refreshPins = useCallback(async () => {
    try {
      const [pinned, recent] = await Promise.all([
        window.electronAPI.notesExtras.getPinned(),
        window.electronAPI.notesExtras.getRecent(),
      ])
      setPinnedIds(pinned)
      setRecentIds(recent)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    void refreshPins()
  }, [refreshPins, notes])

  const handleTrashRefresh = () => {
    const refresh = (window as any).__recycleBinRefresh
    if (typeof refresh === 'function') refresh()
  }

  const handleTrashEmpty = () => {
    const setConfirmEmpty = (window as any).__recycleBinSetConfirmEmpty
    if (typeof setConfirmEmpty === 'function') setConfirmEmpty(true)
  }

  const handleTrashLoaded = useCallback((items: any[]) => {
    setTrashHasItems(items.length > 0)
  }, [])

  const togglePin = async (noteId: string) => {
    const next = pinnedIds.includes(noteId)
      ? pinnedIds.filter(id => id !== noteId)
      : [noteId, ...pinnedIds].slice(0, 50)
    setPinnedIds(await window.electronAPI.notesExtras.setPinned(next))
  }

  return (
    <div className="sidebar sidebar-shell">
      <nav className="sidebar-rail">
        <div className="sidebar-rail-logo" aria-label="arkNote">
          <DefaultAvatar alt="arkNote" size={30} />
        </div>

        <div className="sidebar-rail-nav">
          {mainTabs.map(tab => (
            <button
              key={tab.id}
              className={`sidebar-rail-item ${sidebarTab === tab.id ? 'active' : ''}`}
              onClick={() => setSidebarTab(tab.id)}
              title={tab.label}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-rail-bottom">
          <button
            className="sidebar-rail-item"
            onClick={() => void onOpenDailyNote?.()}
            title={t('今日日记')}
          >
            <BookOpen size={18} strokeWidth={1.6} />
            <span>{t('日记')}</span>
          </button>
          <button
            className="sidebar-rail-item"
            onClick={() => onOpenTimeCapsule?.()}
            title={t('时间胶囊')}
          >
            <CalendarDays size={18} strokeWidth={1.6} />
            <span>{t('胶囊')}</span>
          </button>
          <button
            className="sidebar-rail-item"
            onClick={openSettingsDialog}
            title={t('设置')}
          >
            <Settings size={18} strokeWidth={1.6} />
            <span>{t('设置')}</span>
          </button>
        </div>
      </nav>

      <section className="sidebar-panel">
        {sidebarTab === 'files' && (
          <>
            {(pinnedIds.length > 0 || recentIds.length > 0) && (
              <div style={{ padding: '8px 10px', borderBottom: '0.5px solid var(--border)' }}>
                {pinnedIds.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Pin size={12} /> {t('置顶')}
                    </div>
                    {pinnedIds.map(id => {
                      const note = noteById.get(id)
                      if (!note) return null
                      return (
                        <button
                          key={id}
                          className="btn"
                          style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 2, fontSize: 12 }}
                          onClick={() => void openNote(id)}
                          onContextMenu={(e) => {
                            e.preventDefault()
                            void togglePin(id)
                          }}
                          title={t('右键取消置顶')}
                        >
                          {note.title || t('未命名笔记')}
                        </button>
                      )
                    })}
                  </div>
                )}
                {recentIds.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock3 size={12} /> {t('最近')}
                    </div>
                    {recentIds.slice(0, 8).map(id => {
                      const note = noteById.get(id)
                      if (!note) return null
                      return (
                        <button
                          key={id}
                          className="btn"
                          style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 2, fontSize: 12 }}
                          onClick={() => void openNote(id)}
                          onContextMenu={(e) => {
                            e.preventDefault()
                            void togglePin(id)
                          }}
                          title={t('右键置顶')}
                        >
                          {note.title || t('未命名笔记')}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
            <DirectoryTree />
          </>
        )}
        {sidebarTab === 'search' && <GlobalSearch />}
        {sidebarTab === 'tags' && <TagList />}
        {sidebarTab === 'trash' && (
          <>
            <div className="sidebar-panel-actions">
              <button className="icon-btn sm" onClick={handleTrashRefresh} title={t('刷新')}>
                <RefreshCw size={14} strokeWidth={1.5} />
              </button>
              {trashHasItems && (
                <button className="icon-btn sm danger" onClick={handleTrashEmpty} title={t('清空回收站')}>
                  <Trash2 size={14} strokeWidth={1.5} />
                </button>
              )}
            </div>
            <RecycleBin onTrashLoaded={handleTrashLoaded} />
          </>
        )}
      </section>
    </div>
  )
}
