// ========== Core Data Types ==========

import type { AppLanguage } from '../../shared/i18n'
export type { AppLanguage } from '../../shared/i18n'

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

/** Git is the only live sync provider. OSS is reserved for future cold backup. */
export type SyncProvider = 'git'

export interface SyncConfig {
  enabled: boolean
  provider: SyncProvider
  // Git settings
  repoUrl: string
  branch: string
  /**
   * HTTPS personal access token / password.
   * Stored only in local app config (~/.ark-note-config.json), never in the vault Git tree.
   */
  httpsToken?: string
  // Common
  autoSync: boolean
  syncInterval: number // minutes
}

export interface SyncConflict {
  file: string
  /** Human-readable label (note title / path) for UI */
  displayName?: string
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
  /** Categorized failure for UI: auth | conflict | network | other */
  errorKind?: 'auth' | 'conflict' | 'network' | 'other'
}

export interface VaultIntegrityIssue {
  path: string
  severity: 'error' | 'warning'
  message: string
}

export interface VaultIntegrityReport {
  ok: boolean
  checkedAt: string
  saltOk: boolean
  verifyOk: boolean
  metadataOk: boolean
  notesChecked: number
  notesOk: number
  imagesChecked: number
  imagesOk: number
  versionsChecked: number
  versionsOk: number
  issues: VaultIntegrityIssue[]
}

export interface ColdBackupConfig {
  enabled: boolean
  endpoint: string
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  prefix: string
  intervalHours: number
  lastBackupAt: string | null
  lastError: string | null
}

export interface TimeCapsuleNote {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface ColdBackupActionResult {
  success: boolean
  message: string
  detail?: string
}

export interface EditorPrefs {
  fontSize: number
  defaultView: 'edit' | 'preview' | 'split'
}

export interface SearchOptions {
  directoryIds?: string[]
  tagIds?: string[]
  totalLimit?: number
  offset?: number
}

export type AuthErrorCode =
  | 'invalid_password'
  | 'rate_limited'
  | 'weak_password'
  | 'vault_integrity'
  | 'unlock_failed'

export interface AuthResult {
  success: boolean
  isFirstTime?: boolean
  error?: AuthErrorCode
  message?: string
  retryAfterMs: number
  failedAttempts: number
}

export interface AuthThrottleStatus {
  retryAfterMs: number
  failedAttempts: number
}

export interface VaultRestoreRequest {
  repoUrl: string
  branch: string
  httpsToken?: string
}

export interface VaultRestoreResult {
  success: boolean
  message: string
}

export interface SecurityConfig {
  autoLockMinutes: number
  lockOnMinimize: boolean
}

export type AppUpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'
  | 'disabled'

export interface AppUpdateState {
  phase: AppUpdatePhase
  currentVersion: string
  availableVersion: string | null
  progress: number | null
  message: string
  checkedAt: string | null
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
    unlock: (password: string) => Promise<AuthResult>
    lock: () => Promise<void>
    isLocked: () => Promise<boolean>
    isFirstTime: () => Promise<boolean>
    getUnlockStatus: () => Promise<AuthThrottleStatus>
    restoreFromGit: (request: VaultRestoreRequest) => Promise<VaultRestoreResult>
    changePassword: (oldPassword: string, newPassword: string) => Promise<AuthResult>
    onLocked: (callback: () => void) => void
    removeAllListeners: () => void
  }
  // Notes
  notes: {
    list: () => Promise<NoteMetadata[]>
    get: (id: string) => Promise<NoteContent>
    create: (directoryId: string, title: string) => Promise<NoteMetadata>
    update: (id: string, content: string) => Promise<void>
    updateTitle: (id: string, title: string) => Promise<void>
    delete: (id: string) => Promise<void>
    move: (id: string, targetDirectoryId: string, beforeId?: string | null) => Promise<void>
    download: (id: string) => Promise<void>
    exportPdf: (id: string, htmlContent: string, title?: string) => Promise<void>
    renderShareImage: (
      id: string,
      htmlContent: string,
      title?: string,
    ) => Promise<{ success: boolean; dataUrl?: string; message?: string }>
    saveShareImage: (
      dataUrl: string,
      defaultName?: string,
    ) => Promise<{ success: boolean; canceled?: boolean; filePath?: string; message?: string }>
    batchExport: (directoryId?: string) => Promise<{ success: boolean; message: string }>
  }
  // Directories
  directories: {
    list: () => Promise<Directory[]>
    create: (parentId: string | null, name: string) => Promise<Directory>
    rename: (id: string, name: string) => Promise<void>
    move: (id: string, targetParentId: string | null, beforeId?: string | null) => Promise<boolean>
    delete: (id: string) => Promise<boolean>
    getLevel: (id: string) => Promise<number>
  }
  // Tags
  tags: {
    list: () => Promise<Tag[]>
    create: (name: string, color: string) => Promise<Tag>
    rename: (id: string, name: string) => Promise<Tag>
    delete: (id: string, removeFromNotes?: boolean) => Promise<{ success: boolean; message: string }>
    assign: (noteId: string, tagIds: string[]) => Promise<void>
    getNotesForTag: (tagId: string) => Promise<NoteMetadata[]>
  }
  // Versions
  versions: {
    list: (noteId: string) => Promise<Version[]>
    get: (noteId: string, timestamp: string) => Promise<string>
    save: (noteId: string) => Promise<void>
    diff: (noteId: string, timestamp: string) => Promise<{ current: string; version: string; unified: string }>
    prune: (noteId?: string) => Promise<{ removed: number }>
  }
  // Search
  search: {
    global: (query: string, directoryIds?: string[], totalLimit?: number, tagIds?: string[], offset?: number) => Promise<SearchResult[]>
    byTitle: (query: string, limit?: number) => Promise<NoteMetadata[]>
    inNote: (noteId: string, query: string) => Promise<SearchMatch[]>
    backlinks: (noteId: string) => Promise<NoteMetadata[]>
  }
  // Images
  images: {
    save: (noteId: string, imageData: string, fileName: string) => Promise<string>
    get: (imageId: string) => Promise<string>
    inlineInMarkdown: (content: string) => Promise<string>
    selectAndSave: (noteId: string) => Promise<string | null>
  }
  // Clipboard
  clipboard: {
    writeImage: (dataUrl: string) => Promise<{ success: boolean; message?: string }>
    writeText: (text: string) => Promise<{ success: boolean; message?: string }>
  }
  // Sync
  sync: {
    configure: (config: SyncConfig) => Promise<void>
    sync: () => Promise<SyncStatus>
    getStatus: () => Promise<SyncStatus>
    getConfig: () => Promise<SyncConfig>
    resolveConflicts: (resolutions: Array<{ file: string; resolution: 'local' | 'remote' }>) => Promise<SyncStatus>
    onAutoSyncRequested: (callback: () => void) => void
    respondToAutoSyncRequest: (ok: boolean) => Promise<void>
    onDataChanged: (callback: () => void) => void
    removeAllListeners: () => void
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
    importFolder: (directoryId: string | null) => Promise<{ success: boolean; imported: number; message: string }>
  }
  // Vault backup / integrity
  vault: {
    exportBackup: () => Promise<{ success: boolean; canceled?: boolean; filePath?: string; message: string }>
    verifyIntegrity: () => Promise<VaultIntegrityReport>
    getRecoveryTipPending?: () => Promise<boolean>
    dismissRecoveryTip?: () => Promise<void>
  }
  // Notes extras
  notesExtras: {
    getPinned: () => Promise<string[]>
    setPinned: (noteIds: string[]) => Promise<string[]>
    getRecent: () => Promise<string[]>
    touchRecent: (noteId: string) => Promise<string[]>
    getEditorPrefs: () => Promise<EditorPrefs>
    setEditorPrefs: (prefs: Partial<EditorPrefs>) => Promise<EditorPrefs>
    createFromTemplate: (directoryId: string, template: 'blank' | 'daily' | 'meeting') => Promise<NoteMetadata>
    getDailyNote: () => Promise<NoteMetadata>
    getOutline: (noteId: string) => Promise<Array<{ level: number; text: string; line: number }>>
    listAttachments: (noteId: string) => Promise<Array<{ id: string; name: string; mime: string }>>
    addAttachment: (noteId: string) => Promise<{ id: string; name: string; mime: string } | null>
    openAttachment: (attachmentId: string) => Promise<{ success: boolean; message?: string }>
    getTimeCapsule: () => Promise<Array<{ year: number; month: number; created: number; updated: number }>>
    listByMonth: (request: {
      year: number
      month: number
      mode?: 'created' | 'updated'
    }) => Promise<TimeCapsuleNote[]>
  }
  // Cold backup (S3-compatible encrypted snapshot channel)
  coldBackup: {
    getConfig: () => Promise<ColdBackupConfig>
    setConfig: (config: ColdBackupConfig) => Promise<ColdBackupConfig>
    runNow: () => Promise<ColdBackupActionResult>
    testConnection: () => Promise<ColdBackupActionResult>
    restoreFromFile: () => Promise<ColdBackupActionResult>
  }
  // App Config
  config: {
    getDataDir: () => Promise<string>
    setDataDir: (newDir: string) => Promise<{ success: boolean; message: string }>
    selectDataDir: () => Promise<string | null>
    inspectDataDir: (dir: string) => Promise<{ mode: 'current' | 'switch' | 'migrate'; message: string }>
    getAll: () => Promise<{
      dataDir: string
      defaultDataDir: string
      configPath: string
      theme: 'dark' | 'light'
      language: AppLanguage
      sidebarWidth: number
      autoLockMinutes: number
      lockOnMinimize: boolean
      editorFontSize: number
      editorDefaultView: 'edit' | 'preview' | 'split'
      pinnedNoteIds: string[]
      recentNoteIds: string[]
    }>
    restartApp: () => Promise<void>
    getTheme: () => Promise<'dark' | 'light'>
    setTheme: (theme: 'dark' | 'light') => Promise<void>
    getLanguage: () => Promise<AppLanguage>
    setLanguage: (language: AppLanguage) => Promise<void>
    getSidebarWidth: () => Promise<number>
    setSidebarWidth: (width: number) => Promise<void>
    getSecurity: () => Promise<SecurityConfig>
    setSecurity: (config: SecurityConfig) => Promise<SecurityConfig>
  }
  updates: {
    getState: () => Promise<AppUpdateState>
    check: () => Promise<AppUpdateState>
    download: () => Promise<AppUpdateState>
    install: () => Promise<boolean>
    onStateChanged: (callback: (state: AppUpdateState) => void) => () => void
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

