import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI } from '../src/types'

const api: ElectronAPI = {
  auth: {
    unlock: (password: string) => ipcRenderer.invoke('auth:unlock', password),
    lock: () => ipcRenderer.invoke('auth:lock'),
    isLocked: () => ipcRenderer.invoke('auth:isLocked'),
    isFirstTime: () => ipcRenderer.invoke('auth:isFirstTime'),
    changePassword: (oldPassword: string, newPassword: string) =>
      ipcRenderer.invoke('auth:changePassword', oldPassword, newPassword),
  },
  notes: {
    list: () => ipcRenderer.invoke('notes:list'),
    get: (id: string) => ipcRenderer.invoke('notes:get', id),
    create: (directoryId: string, title: string) =>
      ipcRenderer.invoke('notes:create', directoryId, title),
    update: (id: string, content: string) =>
      ipcRenderer.invoke('notes:update', id, content),
    updateTitle: (id: string, title: string) =>
      ipcRenderer.invoke('notes:updateTitle', id, title),
    delete: (id: string) => ipcRenderer.invoke('notes:delete', id),
    move: (id: string, targetDirectoryId: string) =>
      ipcRenderer.invoke('notes:move', id, targetDirectoryId),
    download: (id: string) => ipcRenderer.invoke('notes:download', id),
    exportPdf: (id: string, htmlContent: string) =>
      ipcRenderer.invoke('notes:exportPdf', id, htmlContent),
    batchExport: (directoryId?: string) =>
      ipcRenderer.invoke('notes:batchExport', directoryId),
  },
  directories: {
    list: () => ipcRenderer.invoke('directories:list'),
    create: (parentId: string | null, name: string) =>
      ipcRenderer.invoke('directories:create', parentId, name),
    rename: (id: string, name: string) =>
      ipcRenderer.invoke('directories:rename', id, name),
    delete: (id: string) => ipcRenderer.invoke('directories:delete', id),
    getLevel: (id: string) => ipcRenderer.invoke('directories:getLevel', id),
  },
  tags: {
    list: () => ipcRenderer.invoke('tags:list'),
    create: (name: string, color: string) =>
      ipcRenderer.invoke('tags:create', name, color),
    delete: (id: string) => ipcRenderer.invoke('tags:delete', id),
    assign: (noteId: string, tagIds: string[]) =>
      ipcRenderer.invoke('tags:assign', noteId, tagIds),
    getNotesForTag: (tagId: string) =>
      ipcRenderer.invoke('tags:getNotesForTag', tagId),
  },
  versions: {
    list: (noteId: string) => ipcRenderer.invoke('versions:list', noteId),
    get: (noteId: string, timestamp: string) =>
      ipcRenderer.invoke('versions:get', noteId, timestamp),
    save: (noteId: string) => ipcRenderer.invoke('versions:save', noteId),
  },
  search: {
    global: (query: string, directoryIds?: string[], totalLimit?: number) =>
      ipcRenderer.invoke('search:global', query, directoryIds, totalLimit),
    inNote: (noteId: string, query: string) =>
      ipcRenderer.invoke('search:inNote', noteId, query),
  },
  images: {
    save: (noteId: string, imageData: string, fileName: string) =>
      ipcRenderer.invoke('images:save', noteId, imageData, fileName),
    get: (imageId: string) => ipcRenderer.invoke('images:get', imageId),
    selectAndSave: (noteId: string) =>
      ipcRenderer.invoke('images:selectAndSave', noteId),
  },
  sync: {
    configure: (config) => ipcRenderer.invoke('sync:configure', config),
    push: () => ipcRenderer.invoke('sync:push'),
    pull: () => ipcRenderer.invoke('sync:pull'),
    getStatus: () => ipcRenderer.invoke('sync:getStatus'),
    getConfig: () => ipcRenderer.invoke('sync:getConfig'),
    resolveConflicts: (resolutions) => ipcRenderer.invoke('sync:resolveConflicts', resolutions),
  },
  trash: {
    list: () => ipcRenderer.invoke('trash:list'),
    restore: (id: string, type: 'directory' | 'note') =>
      ipcRenderer.invoke('trash:restore', id, type),
    deletePermanently: (id: string, type: 'directory' | 'note') =>
      ipcRenderer.invoke('trash:deletePermanently', id, type),
    empty: () => ipcRenderer.invoke('trash:empty'),
    getNoteContent: (noteId: string) => ipcRenderer.invoke('trash:getNoteContent', noteId),
    listVersions: (noteId: string) => ipcRenderer.invoke('trash:listVersions', noteId),
    getVersion: (noteId: string, timestamp: string) => ipcRenderer.invoke('trash:getVersion', noteId, timestamp),
  },
  import: {
    importMd: (directoryId: string) => ipcRenderer.invoke('import:importMd', directoryId),
    importPdf: (directoryId: string) => ipcRenderer.invoke('import:importPdf', directoryId),
  },
  config: {
    getDataDir: () => ipcRenderer.invoke('config:getDataDir'),
    setDataDir: (newDir: string) => ipcRenderer.invoke('config:setDataDir', newDir),
    selectDataDir: () => ipcRenderer.invoke('config:selectDataDir'),
    inspectDataDir: (dir: string) => ipcRenderer.invoke('config:inspectDataDir', dir),
    getAll: () => ipcRenderer.invoke('config:getAll'),
    restartApp: () => ipcRenderer.invoke('config:restartApp'),
    getTheme: () => ipcRenderer.invoke('config:getTheme'),
    setTheme: (theme: 'dark' | 'light') => ipcRenderer.invoke('config:setTheme', theme),
    getSidebarWidth: () => ipcRenderer.invoke('config:getSidebarWidth'),
    setSidebarWidth: (width: number) => ipcRenderer.invoke('config:setSidebarWidth', width),
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    closeAction: (action: 'minimize' | 'quit', remember: boolean) =>
      ipcRenderer.invoke('window:close-action', action, remember),
    getCloseAction: () => ipcRenderer.invoke('window:get-close-action'),
    setCloseAction: (action: 'ask' | 'minimize' | 'quit') =>
      ipcRenderer.invoke('window:set-close-action', action),
    openExternal: (url: string) => ipcRenderer.invoke('window:openExternal', url),
    onCloseRequested: (callback: () => void) => {
      ipcRenderer.on('window:close-requested', callback)
    },
    onQuitRequested: (callback: () => void) => {
      ipcRenderer.on('window:quit-requested', callback)
    },
    respondToQuitRequest: (ok: boolean) => ipcRenderer.invoke('window:quit-response', { ok }),
    onMaximizedChanged: (callback: (maximized: boolean) => void) => {
      ipcRenderer.on('window:maximized-changed', (_event, maximized: boolean) => callback(maximized))
    },
    removeAllListeners: () => {
      ipcRenderer.removeAllListeners('window:close-requested')
      ipcRenderer.removeAllListeners('window:quit-requested')
      ipcRenderer.removeAllListeners('window:maximized-changed')
    },
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)
