import React, { useCallback, useState } from 'react'
import { FolderTree, RefreshCw, Settings, Tag, Trash2 } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { DirectoryTree } from './DirectoryTree'
import { TagList } from './TagList'
import { RecycleBin } from './RecycleBin'
import type { SidebarTab } from '../../types'

export const Sidebar: React.FC = () => {
  const { sidebarTab, setSidebarTab, openSettingsDialog } = useStore()
  const [trashHasItems, setTrashHasItems] = useState(false)

  const mainTabs: { id: SidebarTab; icon: React.ReactNode; label: string }[] = [
    { id: 'files', icon: <FolderTree size={18} strokeWidth={1.6} />, label: '全部笔记' },
    { id: 'tags', icon: <Tag size={18} strokeWidth={1.6} />, label: '标签' },
    { id: 'trash', icon: <Trash2 size={18} strokeWidth={1.6} />, label: '回收站' },
  ]

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

  return (
    <div className="sidebar sidebar-shell">
      <nav className="sidebar-rail">
        <div className="sidebar-rail-logo" aria-label="ZZ-Note">
          <img src="icon.png" alt="ZZ-Note" />
        </div>

        <div className="sidebar-rail-nav">
          {mainTabs.map(tab => (
            <button
              key={tab.id}
              className={`sidebar-rail-item ${(tab.id === 'files' ? sidebarTab === 'files' || sidebarTab === 'search' : sidebarTab === tab.id) ? 'active' : ''}`}
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
            onClick={openSettingsDialog}
            title="设置"
          >
            <Settings size={18} strokeWidth={1.6} />
            <span>设置</span>
          </button>
        </div>
      </nav>

      <section className="sidebar-panel">
        {sidebarTab === 'files' && <DirectoryTree />}
        {sidebarTab === 'tags' && <TagList />}
        {sidebarTab === 'trash' && (
          <>
            <div className="sidebar-panel-actions">
              <button className="icon-btn sm" onClick={handleTrashRefresh} title="刷新">
                <RefreshCw size={14} strokeWidth={1.5} />
              </button>
              {trashHasItems && (
                <button className="icon-btn sm danger" onClick={handleTrashEmpty} title="清空回收站">
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
