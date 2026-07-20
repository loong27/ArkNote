"use strict";
const electron = require("electron");
const api = {
  auth: {
    unlock: (password) => electron.ipcRenderer.invoke("auth:unlock", password),
    lock: () => electron.ipcRenderer.invoke("auth:lock"),
    isLocked: () => electron.ipcRenderer.invoke("auth:isLocked"),
    isFirstTime: () => electron.ipcRenderer.invoke("auth:isFirstTime"),
    getUnlockStatus: () => electron.ipcRenderer.invoke("auth:getUnlockStatus"),
    restoreFromGit: (request) => electron.ipcRenderer.invoke("auth:restoreFromGit", request),
    changePassword: (oldPassword, newPassword) => electron.ipcRenderer.invoke("auth:changePassword", oldPassword, newPassword),
    onLocked: (callback) => {
      electron.ipcRenderer.on("auth:locked", callback);
    },
    removeAllListeners: () => {
      electron.ipcRenderer.removeAllListeners("auth:locked");
    }
  },
  notes: {
    list: () => electron.ipcRenderer.invoke("notes:list"),
    get: (id) => electron.ipcRenderer.invoke("notes:get", id),
    create: (directoryId, title) => electron.ipcRenderer.invoke("notes:create", directoryId, title),
    update: (id, content) => electron.ipcRenderer.invoke("notes:update", id, content),
    updateTitle: (id, title) => electron.ipcRenderer.invoke("notes:updateTitle", id, title),
    delete: (id) => electron.ipcRenderer.invoke("notes:delete", id),
    move: (id, targetDirectoryId) => electron.ipcRenderer.invoke("notes:move", id, targetDirectoryId),
    download: (id) => electron.ipcRenderer.invoke("notes:download", id),
    exportPdf: (id, htmlContent) => electron.ipcRenderer.invoke("notes:exportPdf", id, htmlContent),
    batchExport: (directoryId) => electron.ipcRenderer.invoke("notes:batchExport", directoryId)
  },
  directories: {
    list: () => electron.ipcRenderer.invoke("directories:list"),
    create: (parentId, name) => electron.ipcRenderer.invoke("directories:create", parentId, name),
    rename: (id, name) => electron.ipcRenderer.invoke("directories:rename", id, name),
    delete: (id) => electron.ipcRenderer.invoke("directories:delete", id),
    getLevel: (id) => electron.ipcRenderer.invoke("directories:getLevel", id)
  },
  tags: {
    list: () => electron.ipcRenderer.invoke("tags:list"),
    create: (name, color) => electron.ipcRenderer.invoke("tags:create", name, color),
    delete: (id) => electron.ipcRenderer.invoke("tags:delete", id),
    assign: (noteId, tagIds) => electron.ipcRenderer.invoke("tags:assign", noteId, tagIds),
    getNotesForTag: (tagId) => electron.ipcRenderer.invoke("tags:getNotesForTag", tagId)
  },
  versions: {
    list: (noteId) => electron.ipcRenderer.invoke("versions:list", noteId),
    get: (noteId, timestamp) => electron.ipcRenderer.invoke("versions:get", noteId, timestamp),
    save: (noteId) => electron.ipcRenderer.invoke("versions:save", noteId)
  },
  search: {
    global: (query, directoryIds, totalLimit) => electron.ipcRenderer.invoke("search:global", query, directoryIds, totalLimit),
    inNote: (noteId, query) => electron.ipcRenderer.invoke("search:inNote", noteId, query)
  },
  images: {
    save: (noteId, imageData, fileName) => electron.ipcRenderer.invoke("images:save", noteId, imageData, fileName),
    get: (imageId) => electron.ipcRenderer.invoke("images:get", imageId),
    selectAndSave: (noteId) => electron.ipcRenderer.invoke("images:selectAndSave", noteId)
  },
  sync: {
    configure: (config) => electron.ipcRenderer.invoke("sync:configure", config),
    sync: () => electron.ipcRenderer.invoke("sync:run"),
    getStatus: () => electron.ipcRenderer.invoke("sync:getStatus"),
    getConfig: () => electron.ipcRenderer.invoke("sync:getConfig"),
    resolveConflicts: (resolutions) => electron.ipcRenderer.invoke("sync:resolveConflicts", resolutions),
    onAutoSyncRequested: (callback) => {
      electron.ipcRenderer.on("sync:auto-requested", callback);
    },
    respondToAutoSyncRequest: (ok) => electron.ipcRenderer.invoke("sync:auto-response", { ok }),
    onDataChanged: (callback) => {
      electron.ipcRenderer.on("sync:data-changed", callback);
    },
    removeAllListeners: () => {
      electron.ipcRenderer.removeAllListeners("sync:auto-requested");
      electron.ipcRenderer.removeAllListeners("sync:data-changed");
    }
  },
  trash: {
    list: () => electron.ipcRenderer.invoke("trash:list"),
    restore: (id, type) => electron.ipcRenderer.invoke("trash:restore", id, type),
    deletePermanently: (id, type) => electron.ipcRenderer.invoke("trash:deletePermanently", id, type),
    empty: () => electron.ipcRenderer.invoke("trash:empty"),
    getNoteContent: (noteId) => electron.ipcRenderer.invoke("trash:getNoteContent", noteId),
    listVersions: (noteId) => electron.ipcRenderer.invoke("trash:listVersions", noteId),
    getVersion: (noteId, timestamp) => electron.ipcRenderer.invoke("trash:getVersion", noteId, timestamp)
  },
  import: {
    importMd: (directoryId) => electron.ipcRenderer.invoke("import:importMd", directoryId),
    importPdf: (directoryId) => electron.ipcRenderer.invoke("import:importPdf", directoryId)
  },
  config: {
    getDataDir: () => electron.ipcRenderer.invoke("config:getDataDir"),
    setDataDir: (newDir) => electron.ipcRenderer.invoke("config:setDataDir", newDir),
    selectDataDir: () => electron.ipcRenderer.invoke("config:selectDataDir"),
    inspectDataDir: (dir) => electron.ipcRenderer.invoke("config:inspectDataDir", dir),
    getAll: () => electron.ipcRenderer.invoke("config:getAll"),
    restartApp: () => electron.ipcRenderer.invoke("config:restartApp"),
    getTheme: () => electron.ipcRenderer.invoke("config:getTheme"),
    setTheme: (theme) => electron.ipcRenderer.invoke("config:setTheme", theme),
    getLanguage: () => electron.ipcRenderer.invoke("config:getLanguage"),
    setLanguage: (language) => electron.ipcRenderer.invoke("config:setLanguage", language),
    getSidebarWidth: () => electron.ipcRenderer.invoke("config:getSidebarWidth"),
    setSidebarWidth: (width) => electron.ipcRenderer.invoke("config:setSidebarWidth", width),
    getSecurity: () => electron.ipcRenderer.invoke("config:getSecurity"),
    setSecurity: (config) => electron.ipcRenderer.invoke("config:setSecurity", config)
  },
  updates: {
    getState: () => electron.ipcRenderer.invoke("updates:getState"),
    check: () => electron.ipcRenderer.invoke("updates:check"),
    download: () => electron.ipcRenderer.invoke("updates:download"),
    install: () => electron.ipcRenderer.invoke("updates:install"),
    onStateChanged: (callback) => {
      const listener = (_event, state) => callback(state);
      electron.ipcRenderer.on("updates:state-changed", listener);
      return () => electron.ipcRenderer.removeListener("updates:state-changed", listener);
    }
  },
  window: {
    minimize: () => electron.ipcRenderer.invoke("window:minimize"),
    maximize: () => electron.ipcRenderer.invoke("window:maximize"),
    isMaximized: () => electron.ipcRenderer.invoke("window:isMaximized"),
    closeAction: (action, remember) => electron.ipcRenderer.invoke("window:close-action", action, remember),
    getCloseAction: () => electron.ipcRenderer.invoke("window:get-close-action"),
    setCloseAction: (action) => electron.ipcRenderer.invoke("window:set-close-action", action),
    openExternal: (url) => electron.ipcRenderer.invoke("window:openExternal", url),
    onCloseRequested: (callback) => {
      electron.ipcRenderer.on("window:close-requested", callback);
    },
    onQuitRequested: (callback) => {
      electron.ipcRenderer.on("window:quit-requested", callback);
    },
    respondToQuitRequest: (ok) => electron.ipcRenderer.invoke("window:quit-response", { ok }),
    onMaximizedChanged: (callback) => {
      electron.ipcRenderer.on("window:maximized-changed", (_event, maximized) => callback(maximized));
    },
    removeAllListeners: () => {
      electron.ipcRenderer.removeAllListeners("window:close-requested");
      electron.ipcRenderer.removeAllListeners("window:quit-requested");
      electron.ipcRenderer.removeAllListeners("window:maximized-changed");
    }
  }
};
electron.contextBridge.exposeInMainWorld("electronAPI", api);
