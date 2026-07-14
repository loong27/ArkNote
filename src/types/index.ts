// ========== Core Data Types ==========

export interface Directory {
  id: string
  name: string
  parentId: string | null
  order: number
  createdAt: string
  updatedAt: string
}

export interface NoteMetadata {
  id: string
  title: string
  directoryId: string
  tags: string[]
  createdAt: string
  updatedAt: string
  order: number
}

export interface NoteContent {
  id: string
  content: string
  metadata: NoteMetadata
}

export interface Tag {
  id: string
  name: string
  color: string
  createdAt: string
}

export interface Version {
  noteId: string
  timestamp: string
  title: string
  isManual: boolean
}

// ========== Search Types ==========

export interface SearchResult {
  noteId: string
  noteTitle: string
  directoryId: string
  directoryPath: string
  matches: SearchMatch[]
}

export interface SearchMatch {
  line: number
  column: number
  length: number
  text: string
  context: string
}

// ========== Sync Types ==========

export type SyncProvider = 'git' | 'oss'

export interface SyncConfig {
  enabled: boolean
  provider: SyncProvider
  // Git settings
  repoUrl: string
  branch: string
  // OSS settings
  ossEndpoint: string
  ossBucket: string
  ossAccessKey: string
  ossSecretKey: string
  ossRegion: string
  // Common
  autoSync: boolean
  syncInterval: number // minutes
}

export interface SyncConflict {
  file: string
  localContent: string
  remoteContent: string
  resolved: boolean
  resolution?: 'local' | 'remote'
}

export interface SyncStatus {
  lastSync: string | null
  status: 'idle' | 'syncing' | 'error' | 'success' | 'conflict'
  message: string
  conflicts?: SyncConflict[]
}

// ========== Metadata Store (persisted encrypted) ==========

export interface AppMetadata {
  directories: Directory[]
  notes: NoteMetadata[]
  tags: Tag[]
  syncConfig: SyncConfig
}

// ========== UI State Types ==========

export type ViewMode = 'directory' | 'note' | 'welcome' | 'tag'
export type SidebarTab = 'files' | 'tags' | 'search' | 'trash'

export interface TrashItem {
  type: 'directory' | 'note'
  id: string
  name: string
  parentId: string | null
  directoryId?: string
  deletedAt: string
  originalPath: string
}

export type NoteSavePhase = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

export interface NoteSaveState {
  phase: NoteSavePhase
  noteId: string | null
  errorMessage: string | null
  lastSavedAt: string | null
}

export interface TreeNode {
  id: string
  name: string
  type: 'directory' | 'note'
  children?: TreeNode[]
  parentId: string | null
  expanded?: boolean
  level: number
  noteCount?: number
}

// ========== IPC API Types ==========

export interface ElectronAPI {
  // Auth
  auth: {
    unlock: (password: string) => Promise<{ success: boolean; isFirstTime: boolean }>
    lock: () => Promise<void>
    isLocked: () => Promise<boolean>
    isFirstTime: () => Promise<boolean>
    changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>
  }
  // Notes
  notes: {
    list: () => Promise<NoteMetadata[]>
    get: (id: string) => Promise<NoteContent>
    create: (directoryId: string, title: string) => Promise<NoteMetadata>
    update: (id: string, content: string) => Promise<void>
    updateTitle: (id: string, title: string) => Promise<void>
    delete: (id: string) => Promise<void>
    move: (id: string, targetDirectoryId: string) => Promise<void>
    download: (id: string) => Promise<void>
    exportPdf: (id: string, htmlContent: string) => Promise<void>
    batchExport: (directoryId?: string) => Promise<{ success: boolean; message: string }>
  }
  // Directories
  directories: {
    list: () => Promise<Directory[]>
    create: (parentId: string | null, name: string) => Promise<Directory>
    rename: (id: string, name: string) => Promise<void>
    delete: (id: string) => Promise<boolean>
    getLevel: (id: string) => Promise<number>
  }
  // Tags
  tags: {
    list: () => Promise<Tag[]>
    create: (name: string, color: string) => Promise<Tag>
    delete: (id: string) => Promise<{ success: boolean; message: string }>
    assign: (noteId: string, tagIds: string[]) => Promise<void>
    getNotesForTag: (tagId: string) => Promise<NoteMetadata[]>
  }
  // Versions
  versions: {
    list: (noteId: string) => Promise<Version[]>
    get: (noteId: string, timestamp: string) => Promise<string>
    save: (noteId: string) => Promise<void>
  }
  // Search
  search: {
    global: (query: string, directoryIds?: string[], totalLimit?: number) => Promise<SearchResult[]>
    inNote: (noteId: string, query: string) => Promise<SearchMatch[]>
  }
  // Images
  images: {
    save: (noteId: string, imageData: string, fileName: string) => Promise<string>
    get: (imageId: string) => Promise<string>
    selectAndSave: (noteId: string) => Promise<string | null>
  }
  // Sync
  sync: {
    configure: (config: SyncConfig) => Promise<void>
    push: () => Promise<SyncStatus>
    pull: () => Promise<SyncStatus>
    getStatus: () => Promise<SyncStatus>
    getConfig: () => Promise<SyncConfig>
    resolveConflicts: (resolutions: Array<{ file: string; resolution: 'local' | 'remote' }>) => Promise<SyncStatus>
  }
  // Trash / Recycle Bin
  trash: {
    list: () => Promise<TrashItem[]>
    restore: (id: string, type: 'directory' | 'note') => Promise<void>
    deletePermanently: (id: string, type: 'directory' | 'note') => Promise<void>
    empty: () => Promise<void>
    getNoteContent: (noteId: string) => Promise<NoteContent | null>
    listVersions: (noteId: string) => Promise<Version[]>
    getVersion: (noteId: string, timestamp: string) => Promise<string>
  }
  // Import
  import: {
    importMd: (directoryId: string) => Promise<{ success: boolean; noteId?: string; message: string }>
    importPdf: (directoryId: string) => Promise<{ success: boolean; noteId?: string; message: string }>
  }
  // App Config
  config: {
    getDataDir: () => Promise<string>
    setDataDir: (newDir: string) => Promise<{ success: boolean; message: string }>
    selectDataDir: () => Promise<string | null>
    inspectDataDir: (dir: string) => Promise<{ mode: 'current' | 'switch' | 'migrate'; message: string }>
    getAll: () => Promise<{ dataDir: string; defaultDataDir: string; configPath: string; theme: 'dark' | 'light'; sidebarWidth: number }>
    restartApp: () => Promise<void>
    getTheme: () => Promise<'dark' | 'light'>
    setTheme: (theme: 'dark' | 'light') => Promise<void>
    getSidebarWidth: () => Promise<number>
    setSidebarWidth: (width: number) => Promise<void>
  }
  // Window Controls
  window: {
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    isMaximized: () => Promise<boolean>
    closeAction: (action: 'minimize' | 'quit', remember: boolean) => Promise<void>
    getCloseAction: () => Promise<'ask' | 'minimize' | 'quit'>
    setCloseAction: (action: 'ask' | 'minimize' | 'quit') => Promise<void>
    openExternal: (url: string) => Promise<void>
    onCloseRequested: (callback: () => void) => void
    onQuitRequested: (callback: () => void) => void
    respondToQuitRequest: (ok: boolean) => Promise<void>
    onMaximizedChanged: (callback: (maximized: boolean) => void) => void
    removeAllListeners: () => void
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
