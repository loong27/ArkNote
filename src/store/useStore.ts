import { create } from 'zustand'
import type {
  Directory,
  NoteMetadata,
  NoteContent,
  Tag,
  ViewMode,
  SidebarTab,
  SearchResult,
  Version,
  SyncConfig,
  SyncStatus,
  NoteSaveState,
} from '../types'

type SaveCoordinator = {
  flush: () => Promise<void>
  saveVersion: () => Promise<void>
}

type DirectoryPathPart = {
  id: string
  name: string
}

type NoteTab = {
  noteId: string
}

const buildDerivedData = (directories: Directory[], notes: NoteMetadata[], tags: Tag[]) => {
  const dirById = new Map<string, Directory>()
  const noteById = new Map<string, NoteMetadata>()
  const childDirsByParentId = new Map<string | null, Directory[]>()
  const notesByDirectoryId = new Map<string | null, NoteMetadata[]>()
  const directoryPathPartsById = new Map<string, DirectoryPathPart[]>()
  const directoryPathStringById = new Map<string, string>()
  const directoryNoteCounts = new Map<string, number>()
  const tagNoteCounts = new Map<string, number>()

  for (const dir of directories) {
    dirById.set(dir.id, dir)
    const siblings = childDirsByParentId.get(dir.parentId) ?? []
    siblings.push(dir)
    childDirsByParentId.set(dir.parentId, siblings)
  }

  for (const siblingDirs of childDirsByParentId.values()) {
    siblingDirs.sort((a, b) => a.order - b.order)
  }

  for (const note of notes) {
    noteById.set(note.id, note)
    const siblings = notesByDirectoryId.get(note.directoryId) ?? []
    siblings.push(note)
    notesByDirectoryId.set(note.directoryId, siblings)
  }

  for (const siblingNotes of notesByDirectoryId.values()) {
    siblingNotes.sort((a, b) => a.order - b.order)
  }

  for (const dir of directories) {
    const parts: DirectoryPathPart[] = []
    let currentId: string | null = dir.id
    while (currentId) {
      const current = dirById.get(currentId)
      if (!current) break
      parts.unshift({ id: current.id, name: current.name })
      currentId = current.parentId
    }
    directoryPathPartsById.set(dir.id, parts)
    directoryPathStringById.set(dir.id, parts.map(part => part.name).join(' / '))
  }

  const countNotes = (dirId: string): number => {
    const cached = directoryNoteCounts.get(dirId)
    if (cached !== undefined) return cached

    let count = notesByDirectoryId.get(dirId)?.length ?? 0
    const children = childDirsByParentId.get(dirId) ?? []
    for (const child of children) {
      count += countNotes(child.id)
    }
    directoryNoteCounts.set(dirId, count)
    return count
  }

  for (const dir of directories) {
    countNotes(dir.id)
  }

  for (const tag of tags) {
    tagNoteCounts.set(tag.id, 0)
  }
  for (const note of notes) {
    for (const tagId of note.tags) {
      tagNoteCounts.set(tagId, (tagNoteCounts.get(tagId) ?? 0) + 1)
    }
  }

  return {
    dirById,
    noteById,
    childDirsByParentId,
    notesByDirectoryId,
    directoryPathPartsById,
    directoryPathStringById,
    directoryNoteCounts,
    tagNoteCounts,
  }
}

interface AppState {
  // Auth state
  isLocked: boolean
  isFirstTime: boolean

  // Data
  directories: Directory[]
  notes: NoteMetadata[]
  tags: Tag[]

  // UI state
  theme: 'dark' | 'light'
  viewMode: ViewMode
  sidebarTab: SidebarTab
  sidebarWidth: number
  directoryViewMode: 'card' | 'list'
  selectedDirectoryId: string | null
  selectedTagId: string | null
  currentNote: NoteContent | null
  isTrashNote: boolean
  isEditing: boolean
  expandedDirs: Set<string>

  // Derived data
  dirById: Map<string, Directory>
  noteById: Map<string, NoteMetadata>
  childDirsByParentId: Map<string | null, Directory[]>
  notesByDirectoryId: Map<string | null, NoteMetadata[]>
  directoryPathPartsById: Map<string, DirectoryPathPart[]>
  directoryPathStringById: Map<string, string>
  directoryNoteCounts: Map<string, number>
  tagNoteCounts: Map<string, number>

  // Navigation history (back/forward like a browser)
  noteHistory: string[]
  noteHistoryIndex: number

  // Workspace note tabs
  noteTabs: NoteTab[]
  activeNoteTabId: string | null

  // Search
  globalSearchQuery: string
  globalSearchResults: SearchResult[]
  globalSearchDirIds: string[]
  noteSearchQuery: string
  noteSearchVisible: boolean

  // Dialogs
  moveDialogOpen: boolean
  tagDialogOpen: boolean
  versionDialogOpen: boolean
  settingsDialogOpen: boolean
  moveNoteId: string | null
  tagNoteId: string | null
  versionNoteId: string | null
  versions: Version[]

  // Sync
  syncConfig: SyncConfig
  syncStatus: SyncStatus

  // Save
  saveState: NoteSaveState

  // Actions - Auth
  setLocked: (locked: boolean) => void
  setFirstTime: (isFirst: boolean) => void

  // Actions - Data
  setDirectories: (dirs: Directory[]) => void
  setNotes: (notes: NoteMetadata[]) => void
  setTags: (tags: Tag[]) => void
  rebuildDerivedData: () => void
  getDirectoryPathParts: (dirId: string | null) => DirectoryPathPart[]
  getDirectoryPathString: (dirId: string | null) => string
  getDirectoryNoteCount: (dirId: string) => number

  // Actions - UI
  setTheme: (theme: 'dark' | 'light') => void
  setViewMode: (mode: ViewMode) => void
  setSidebarTab: (tab: SidebarTab) => void
  setSidebarWidth: (width: number) => void
  setDirectoryViewMode: (mode: 'card' | 'list') => void
  setSelectedDirectoryId: (id: string | null) => void
  setSelectedTagId: (id: string | null) => void
  setCurrentNote: (note: NoteContent | null) => void
  setIsTrashNote: (isTrashed: boolean) => void
  setIsEditing: (editing: boolean) => void
  toggleDir: (dirId: string) => void
  expandAllDirs: () => void
  collapseAllDirs: () => void
  setExpandedDirs: (dirs: Set<string>) => void

  // Actions - Search
  setGlobalSearchQuery: (query: string) => void
  setGlobalSearchResults: (results: SearchResult[]) => void
  setGlobalSearchDirIds: (ids: string[]) => void
  setNoteSearchQuery: (query: string) => void
  setNoteSearchVisible: (visible: boolean) => void

  // Actions - Dialogs
  openMoveDialog: (noteId: string) => void
  closeMoveDialog: () => void
  openTagDialog: (noteId: string) => void
  closeTagDialog: () => void
  openVersionDialog: (noteId: string) => void
  closeVersionDialog: () => void
  setVersions: (versions: Version[]) => void
  openSettingsDialog: () => void
  closeSettingsDialog: () => void

  // Actions - Sync
  setSyncConfig: (config: SyncConfig) => void
  setSyncStatus: (status: SyncStatus) => void

  // Actions - Save
  setSaveState: (saveState: NoteSaveState) => void
  markNoteDirty: (noteId: string) => void
  markSaveStarted: (noteId: string) => void
  markSaveSucceeded: (noteId: string) => void
  markSaveFailed: (noteId: string | null, message: string) => void
  clearSaveError: () => void
  registerSaveCoordinator: (coordinator: SaveCoordinator | null) => void
  flushPendingSaves: () => Promise<boolean>
  runAfterPendingSave: (action: () => Promise<void>) => Promise<boolean>
  saveManualVersion: () => Promise<boolean>

  // Actions - Navigation
  goBack: () => Promise<void>
  goForward: () => Promise<void>
  canGoBack: () => boolean
  canGoForward: () => boolean

  // Actions - Workspace note tabs
  ensureNoteTab: (noteId: string) => void
  activateNoteTab: (noteId: string) => Promise<void>
  closeNoteTab: (noteId: string) => Promise<void>

  // Actions - Load data
  loadData: () => Promise<void>
  openNote: (noteId: string) => Promise<void>
  openNoteWithoutFlush: (noteId: string, preserveHistory?: boolean) => Promise<void>
  refreshCurrentNote: () => Promise<void>
}

export const useStore = create<AppState>((set, get) => {
  let saveCoordinator: SaveCoordinator | null = null
  const initialDerivedData = buildDerivedData([], [], [])

  return ({
  // Initial state
  isLocked: true,
  isFirstTime: false,

  directories: [],
  notes: [],
  tags: [],

  theme: 'dark',
  viewMode: 'welcome',
  sidebarTab: 'files',
  sidebarWidth: 15,
  directoryViewMode: 'card',
  selectedDirectoryId: null,
  selectedTagId: null,
  currentNote: null,
  isTrashNote: false,
  isEditing: false,
  expandedDirs: new Set<string>(),
  dirById: initialDerivedData.dirById,
  noteById: initialDerivedData.noteById,
  childDirsByParentId: initialDerivedData.childDirsByParentId,
  notesByDirectoryId: initialDerivedData.notesByDirectoryId,
  directoryPathPartsById: initialDerivedData.directoryPathPartsById,
  directoryPathStringById: initialDerivedData.directoryPathStringById,
  directoryNoteCounts: initialDerivedData.directoryNoteCounts,
  tagNoteCounts: initialDerivedData.tagNoteCounts,
  noteHistory: [],
  noteHistoryIndex: -1,
  noteTabs: [],
  activeNoteTabId: null,

  globalSearchQuery: '',
  globalSearchResults: [],
  globalSearchDirIds: [],
  noteSearchQuery: '',
  noteSearchVisible: false,

  moveDialogOpen: false,
  tagDialogOpen: false,
  versionDialogOpen: false,
  settingsDialogOpen: false,
  moveNoteId: null,
  tagNoteId: null,
  versionNoteId: null,
  versions: [],

  syncConfig: {
    enabled: false,
    provider: 'git',
    repoUrl: '',
    branch: 'main',
    ossEndpoint: '',
    ossBucket: '',
    ossAccessKey: '',
    ossSecretKey: '',
    ossRegion: '',
    autoSync: false,
    syncInterval: 30,
  },
  syncStatus: {
    lastSync: null,
    status: 'idle',
    message: '',
  },

  saveState: {
    phase: 'idle',
    noteId: null,
    errorMessage: null,
    lastSavedAt: null,
  },

  // Auth actions
  setLocked: (locked) => {
    if (locked) {
      ;(window as any).__clearImageCache?.()
    }
    set({ isLocked: locked })
  },
  setFirstTime: (isFirst) => set({ isFirstTime: isFirst }),

  // Data actions
  setDirectories: (dirs) => set((state) => ({
    directories: dirs,
    ...buildDerivedData(dirs, state.notes, state.tags),
  })),
  setNotes: (notes) => set((state) => ({
    notes,
    ...buildDerivedData(state.directories, notes, state.tags),
  })),
  setTags: (tags) => set((state) => ({
    tags,
    ...buildDerivedData(state.directories, state.notes, tags),
  })),
  rebuildDerivedData: () => set((state) => ({
    ...buildDerivedData(state.directories, state.notes, state.tags),
  })),
  getDirectoryPathParts: (dirId) => {
    if (!dirId) return []
    return get().directoryPathPartsById.get(dirId) ?? []
  },
  getDirectoryPathString: (dirId) => {
    if (!dirId) return ''
    return get().directoryPathStringById.get(dirId) ?? ''
  },
  getDirectoryNoteCount: (dirId) => get().directoryNoteCounts.get(dirId) ?? 0,

  // UI actions
  setTheme: (theme) => {
    document.documentElement.setAttribute('data-theme', theme)
    window.electronAPI.config.setTheme(theme).catch(console.error)
    set({ theme })
  },
  setViewMode: (mode) => set({ viewMode: mode }),
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  setSidebarWidth: (width) => set({ sidebarWidth: Math.min(40, Math.max(10, width)) }),
  setDirectoryViewMode: (mode) => set({ directoryViewMode: mode }),
  setSelectedDirectoryId: (id) => set({ selectedDirectoryId: id, currentNote: null, isTrashNote: false }),
  setSelectedTagId: (id) => set({
    selectedTagId: id,
    viewMode: id ? 'tag' : 'welcome',
    currentNote: null,
    isTrashNote: false,
  }),
  setCurrentNote: (note) => set({ currentNote: note }),
  setIsTrashNote: (isTrashed) => set({ isTrashNote: isTrashed }),
  setIsEditing: (editing) => set({ isEditing: editing }),

  toggleDir: (dirId) => {
    const expanded = new Set(get().expandedDirs)
    if (expanded.has(dirId)) {
      expanded.delete(dirId)
    } else {
      expanded.add(dirId)
    }
    set({ expandedDirs: expanded })
  },

  expandAllDirs: () => {
    const allDirIds = get().directories.map(d => d.id)
    set({ expandedDirs: new Set(allDirIds) })
  },

  collapseAllDirs: () => {
    set({ expandedDirs: new Set() })
  },

  setExpandedDirs: (dirs) => set({ expandedDirs: dirs }),

  // Search actions
  setGlobalSearchQuery: (query) => set({ globalSearchQuery: query }),
  setGlobalSearchResults: (results) => set({ globalSearchResults: results }),
  setGlobalSearchDirIds: (ids) => set({ globalSearchDirIds: ids }),
  setNoteSearchQuery: (query) => set({ noteSearchQuery: query }),
  setNoteSearchVisible: (visible) => set({ noteSearchVisible: visible }),

  // Dialog actions
  openMoveDialog: (noteId) => set({ moveDialogOpen: true, moveNoteId: noteId }),
  closeMoveDialog: () => set({ moveDialogOpen: false, moveNoteId: null }),
  openTagDialog: (noteId) => set({ tagDialogOpen: true, tagNoteId: noteId }),
  closeTagDialog: () => set({ tagDialogOpen: false, tagNoteId: null }),
  openVersionDialog: (noteId) => set({ versionDialogOpen: true, versionNoteId: noteId }),
  closeVersionDialog: () => set({ versionDialogOpen: false, versionNoteId: null, versions: [] }),
  setVersions: (versions) => set({ versions }),
  openSettingsDialog: () => set({ settingsDialogOpen: true }),
  closeSettingsDialog: () => set({ settingsDialogOpen: false }),

  // Sync actions
  setSyncConfig: (config) => set({ syncConfig: config }),
  setSyncStatus: (status) => set({ syncStatus: status }),

  // Save actions
  setSaveState: (saveState) => set({ saveState }),
  markNoteDirty: (noteId) => set((state) => ({
    saveState: {
      ...state.saveState,
      phase: 'dirty',
      noteId,
      errorMessage: null,
    },
  })),
  markSaveStarted: (noteId) => set((state) => ({
    saveState: {
      ...state.saveState,
      phase: 'saving',
      noteId,
      errorMessage: null,
    },
  })),
  markSaveSucceeded: (noteId) => set((state) => ({
    saveState: {
      ...state.saveState,
      phase: 'saved',
      noteId,
      errorMessage: null,
      lastSavedAt: new Date().toISOString(),
    },
  })),
  markSaveFailed: (noteId, message) => set((state) => ({
    saveState: {
      ...state.saveState,
      phase: 'error',
      noteId,
      errorMessage: message,
    },
  })),
  clearSaveError: () => set((state) => ({
    saveState: state.saveState.phase === 'error'
      ? { ...state.saveState, errorMessage: null, phase: state.saveState.noteId ? 'dirty' : 'idle' }
      : state.saveState,
  })),
  registerSaveCoordinator: (coordinator) => {
    saveCoordinator = coordinator
  },
  flushPendingSaves: async () => {
    if (!saveCoordinator) return true
    try {
      await saveCoordinator.flush()
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存失败'
      const { currentNote } = get()
      get().markSaveFailed(currentNote?.id ?? null, message)
      return false
    }
  },
  runAfterPendingSave: async (action) => {
    if (!(await get().flushPendingSaves())) return false
    try {
      await action()
      return true
    } catch (error) {
      console.error('Guarded action failed:', error)
      return false
    }
  },
  saveManualVersion: async () => {
    if (!saveCoordinator) return true
    try {
      await saveCoordinator.saveVersion()
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存版本失败'
      const { currentNote } = get()
      get().markSaveFailed(currentNote?.id ?? null, message)
      return false
    }
  },

  // Workspace note tabs
  ensureNoteTab: (noteId) => {
    const { noteById, noteTabs } = get()
    if (!noteById.has(noteId)) return
    set({
      noteTabs: noteTabs.some(tab => tab.noteId === noteId) ? noteTabs : [...noteTabs, { noteId }],
      activeNoteTabId: noteId,
    })
  },
  activateNoteTab: async (noteId) => {
    const { noteTabs, flushPendingSaves, openNoteWithoutFlush } = get()
    if (!noteTabs.some(tab => tab.noteId === noteId)) return
    if (!(await flushPendingSaves())) return
    await openNoteWithoutFlush(noteId, true)
  },
  closeNoteTab: async (noteId) => {
    const { noteTabs, activeNoteTabId, flushPendingSaves, openNoteWithoutFlush } = get()
    const tabIndex = noteTabs.findIndex(tab => tab.noteId === noteId)
    if (tabIndex === -1) return

    if (activeNoteTabId !== noteId) {
      set({ noteTabs: noteTabs.filter(tab => tab.noteId !== noteId) })
      return
    }

    if (!(await flushPendingSaves())) return

    const nextTabs = noteTabs.filter(tab => tab.noteId !== noteId)
    const nextTab = nextTabs[tabIndex] ?? nextTabs[tabIndex - 1]

    if (nextTab) {
      set({ noteTabs: nextTabs, activeNoteTabId: nextTab.noteId })
      await openNoteWithoutFlush(nextTab.noteId, true)
      return
    }

    set({
      noteTabs: [],
      activeNoteTabId: null,
      currentNote: null,
      viewMode: 'welcome',
      isTrashNote: false,
      isEditing: false,
      noteSearchVisible: false,
      noteSearchQuery: '',
    })
  },

  // Navigation
  canGoBack: () => get().noteHistoryIndex > 0,
  canGoForward: () => get().noteHistoryIndex < get().noteHistory.length - 1,

  goBack: async () => {
    const { noteHistoryIndex, noteHistory, noteTabs, flushPendingSaves } = get()
    if (noteHistoryIndex <= 0) return
    if (!(await flushPendingSaves())) return
    const newIndex = noteHistoryIndex - 1
    const noteId = noteHistory[newIndex]
    try {
      const noteContent = await window.electronAPI.notes.get(noteId)
      set({
        currentNote: noteContent,
        viewMode: 'note',
        isEditing: get().isEditing,
        isTrashNote: false,
        noteSearchVisible: false,
        noteSearchQuery: '',
        noteHistoryIndex: newIndex,
        selectedDirectoryId: null,
        noteTabs: noteTabs.some(tab => tab.noteId === noteId) ? noteTabs : [...noteTabs, { noteId }],
        activeNoteTabId: noteId,
      })
    } catch (error) {
      console.error('Failed to go back:', error)
    }
  },

  goForward: async () => {
    const { noteHistoryIndex, noteHistory, noteTabs, flushPendingSaves } = get()
    if (noteHistoryIndex >= noteHistory.length - 1) return
    if (!(await flushPendingSaves())) return
    const newIndex = noteHistoryIndex + 1
    const noteId = noteHistory[newIndex]
    try {
      const noteContent = await window.electronAPI.notes.get(noteId)
      set({
        currentNote: noteContent,
        viewMode: 'note',
        isEditing: get().isEditing,
        isTrashNote: false,
        noteSearchVisible: false,
        noteSearchQuery: '',
        noteHistoryIndex: newIndex,
        selectedDirectoryId: null,
        noteTabs: noteTabs.some(tab => tab.noteId === noteId) ? noteTabs : [...noteTabs, { noteId }],
        activeNoteTabId: noteId,
      })
    } catch (error) {
      console.error('Failed to go forward:', error)
    }
  },

  // Load all data from main process
  loadData: async () => {
    try {
      const [directories, notes, tags, theme] = await Promise.all([
        window.electronAPI.directories.list(),
        window.electronAPI.notes.list(),
        window.electronAPI.tags.list(),
        window.electronAPI.config.getTheme(),
      ])
      document.documentElement.setAttribute('data-theme', theme)
      const noteIds = new Set(notes.map(note => note.id))
      set((state) => {
        const noteTabs = state.noteTabs.filter(tab => noteIds.has(tab.noteId))
        const activeNoteTabId = state.activeNoteTabId && noteIds.has(state.activeNoteTabId)
          ? state.activeNoteTabId
          : noteTabs[0]?.noteId ?? null
        const latestCurrentNoteMetadata = state.currentNote && !state.isTrashNote
          ? notes.find(note => note.id === state.currentNote?.id)
          : null
        const currentNote = state.currentNote && !state.isTrashNote && !noteIds.has(state.currentNote.id)
          ? null
          : state.currentNote && latestCurrentNoteMetadata
            ? { ...state.currentNote, metadata: latestCurrentNoteMetadata }
            : state.currentNote
        const viewMode = state.viewMode === 'note' && !state.isTrashNote && !currentNote
          ? 'welcome'
          : state.viewMode

        return {
          directories,
          notes,
          tags,
          theme,
          noteTabs,
          activeNoteTabId,
          currentNote,
          viewMode,
          isEditing: currentNote ? state.isEditing : false,
          noteSearchVisible: currentNote ? state.noteSearchVisible : false,
          noteSearchQuery: currentNote ? state.noteSearchQuery : '',
          ...buildDerivedData(directories, notes, tags),
        }
      })
    } catch (error) {
      console.error('Failed to load data:', error)
    }
  },

  // Open a note (pushes to navigation history)
  openNote: async (noteId: string) => {
    if (!(await get().flushPendingSaves())) return
    await get().openNoteWithoutFlush(noteId)
  },

  openNoteWithoutFlush: async (noteId: string, preserveHistory = false) => {
    try {
      const noteContent = await window.electronAPI.notes.get(noteId)
      const { noteHistory, noteHistoryIndex, noteTabs } = get()
      const nextTabs = noteTabs.some(tab => tab.noteId === noteId) ? noteTabs : [...noteTabs, { noteId }]

      if (preserveHistory) {
        set({
          currentNote: noteContent,
          viewMode: 'note',
          isEditing: get().isEditing,
          isTrashNote: false,
          noteSearchVisible: false,
          noteSearchQuery: '',
          selectedDirectoryId: null,
          noteTabs: nextTabs,
          activeNoteTabId: noteId,
        })
        return
      }

      const newHistory = noteHistory.slice(0, noteHistoryIndex + 1)
      newHistory.push(noteId)
      if (newHistory.length > 50) newHistory.shift()

      set({
        currentNote: noteContent,
        viewMode: 'note',
        isEditing: get().isEditing,
        isTrashNote: false,
        noteSearchVisible: false,
        noteSearchQuery: '',
        noteHistory: newHistory,
        noteHistoryIndex: newHistory.length - 1,
        selectedDirectoryId: null,
        noteTabs: nextTabs,
        activeNoteTabId: noteId,
      })
    } catch (error) {
      console.error('Failed to open note:', error)
    }
  },

  // Refresh current note
  refreshCurrentNote: async () => {
    const { currentNote } = get()
    if (!currentNote) return
    try {
      const noteContent = await window.electronAPI.notes.get(currentNote.id)
      set({ currentNote: noteContent })
    } catch (error) {
      console.error('Failed to refresh note:', error)
    }
  },
})
})
