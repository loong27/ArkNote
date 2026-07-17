import { ipcMain, dialog, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import { EncryptionService } from '../services/encryption'
import { FileManager } from '../services/fileManager'
import { NoteService } from '../services/noteService'
import { DirectoryService } from '../services/directoryService'
import { TagService } from '../services/tagService'
import { VersionService } from '../services/versionService'
import { SearchService } from '../services/searchService'
import { PdfService } from '../services/pdfService'
import { SyncService } from '../services/syncService'
import { TrashService } from '../services/trashService'
import { ImportService } from '../services/importService'
import { AppConfig } from '../services/appConfig'

export function registerIpcHandlers(dataDir: string, appConfig: AppConfig, restartApp: () => Promise<void>) {
  const encryption = new EncryptionService(dataDir)
  const fileManager = new FileManager(dataDir, encryption)
  const noteService = new NoteService(fileManager)
  const directoryService = new DirectoryService(fileManager)
  const tagService = new TagService(fileManager)
  const versionService = new VersionService(fileManager)
  const searchService = new SearchService(fileManager)
  const pdfService = new PdfService()
  const trashService = new TrashService(fileManager)
  const importService = new ImportService(fileManager)
  let pendingAutoSyncResolver: ((ok: boolean) => void) | null = null
  let pendingAutoSyncTimeout: NodeJS.Timeout | null = null

  const reloadDataCaches = () => {
    fileManager.clearCache()
    searchService.clearCache()
    fileManager.loadMetadata()
    trashService.clearCache()
  }

  const settleAutoSyncRequest = (ok: boolean) => {
    if (pendingAutoSyncTimeout) {
      clearTimeout(pendingAutoSyncTimeout)
      pendingAutoSyncTimeout = null
    }

    const resolver = pendingAutoSyncResolver
    pendingAutoSyncResolver = null
    resolver?.(ok)
  }

  const requestRendererFlushForAutoSync = async (): Promise<boolean> => {
    const win = BrowserWindow.getAllWindows().find(window => !window.isDestroyed())
    if (!win) return true

    if (pendingAutoSyncResolver) return false

    return new Promise<boolean>(resolve => {
      pendingAutoSyncResolver = resolve
      win.webContents.send('sync:auto-requested')
      pendingAutoSyncTimeout = setTimeout(() => {
        settleAutoSyncRequest(false)
      }, 10000)
    })
  }

  const syncService = new SyncService(dataDir, {
    beforeAutoSync: requestRendererFlushForAutoSync,
    onDataChanged: () => {
      try {
        reloadDataCaches()
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) {
            win.webContents.send('sync:data-changed')
          }
        }
      } catch (error) {
        console.error('Failed to reload data after sync:', error)
      }
    },
  })

  // ========== Auth ==========

  ipcMain.handle('auth:unlock', async (_event, password: string) => {
    const isFirstTime = encryption.isFirstTime()
    const success = await encryption.unlock(password)
    if (success) {
      fileManager.ensureDirectories()
      fileManager.loadMetadata()
      trashService.ensureTrashDirs()

      // Setup sync if configured
      const meta = fileManager.getMetadata()
      if (meta.syncConfig.enabled) {
        syncService.configure(meta.syncConfig).catch(console.error)
      }
    }
    return { success, isFirstTime }
  })

  ipcMain.handle('auth:lock', async () => {
    noteService.cleanup()
    syncService.cleanup()
    settleAutoSyncRequest(false)
    fileManager.clearCache()
    searchService.clearCache()
    trashService.clearCache()
    encryption.lock()
  })

  ipcMain.handle('auth:isLocked', async () => {
    return encryption.isLocked()
  })

  ipcMain.handle('auth:isFirstTime', async () => {
    return encryption.isFirstTime()
  })

  ipcMain.handle('auth:changePassword', async (_event, oldPassword: string, newPassword: string) => {
    const success = await encryption.changePassword(oldPassword, newPassword)
    if (success) {
      // Reload metadata since the encryption key has changed
      fileManager.clearCache()
      searchService.clearCache()
      fileManager.loadMetadata()
      trashService.clearCache()
    }
    return success
  })

  // ========== App Config ==========

  ipcMain.handle('config:getDataDir', async () => {
    return appConfig.getDataDir()
  })

  ipcMain.handle('config:setDataDir', async (_event, newDir: string) => {
    const oldDir = appConfig.getDataDir()

    // Lock current vault first
    noteService.cleanup()
    syncService.cleanup()
    fileManager.clearCache()
    searchService.clearCache()
    trashService.clearCache()
    encryption.lock()

    // Migrate data
    const result = await appConfig.migrateData(oldDir, newDir)
    return result
  })

  ipcMain.handle('config:selectDataDir', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null

    const result = await dialog.showOpenDialog(win, {
      title: '选择数据存储目录',
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: '选择此目录',
    })

    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('config:inspectDataDir', async (_event, dir: string) => {
    return appConfig.inspectDataDir(dir)
  })

  ipcMain.handle('config:getAll', async () => {
    return {
      dataDir: appConfig.getDataDir(),
      defaultDataDir: AppConfig.getDefaultDataDir(),
      configPath: AppConfig.getConfigPath(),
      theme: appConfig.getTheme(),
      sidebarWidth: appConfig.getSidebarWidth(),
    }
  })

  ipcMain.handle('config:restartApp', async () => {
    await restartApp()
  })

  ipcMain.handle('config:getTheme', async () => {
    return appConfig.getTheme()
  })

  ipcMain.handle('config:setTheme', async (_event, theme: 'dark' | 'light') => {
    appConfig.setTheme(theme)
  })

  ipcMain.handle('config:getSidebarWidth', async () => {
    return appConfig.getSidebarWidth()
  })

  ipcMain.handle('config:setSidebarWidth', async (_event, width: number) => {
    appConfig.setSidebarWidth(width)
  })

  // ========== Notes ==========

  ipcMain.handle('notes:list', async () => {
    return noteService.list()
  })

  ipcMain.handle('notes:get', async (_event, id: string) => {
    return noteService.get(id)
  })

  ipcMain.handle('notes:create', async (_event, directoryId: string, title: string) => {
    const note = noteService.create(directoryId, title)
    searchService.upsertNote(note.id)
    return note
  })

  ipcMain.handle('notes:update', async (_event, id: string, content: string) => {
    noteService.update(id, content)
    searchService.upsertNote(id)
  })

  ipcMain.handle('notes:updateTitle', async (_event, id: string, title: string) => {
    noteService.updateTitle(id, title)
    searchService.upsertNote(id)
  })

  // Delete now moves to trash (soft delete)
  ipcMain.handle('notes:delete', async (_event, id: string) => {
    trashService.trashNote(id)
    searchService.removeNote(id)
  })

  ipcMain.handle('notes:move', async (_event, id: string, targetDirectoryId: string) => {
    noteService.move(id, targetDirectoryId)
    searchService.upsertNote(id)
  })

  // Helper: export a single note MD with images to a target directory
  const exportNoteWithImages = (noteId: string, targetDir: string) => {
    const note = noteService.get(noteId)
    let content = note.content

    // Find all zznote:// image references
    const imageRegex = /!\[([^\]]*)\]\(zznote:\/\/([^)]+)\)/g
    const matches = [...content.matchAll(imageRegex)]

    if (matches.length > 0) {
      const imagesDir = path.join(targetDir, 'images')
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true })
      }

      for (const match of matches) {
        const imageId = match[2]
        try {
          const imageData = fileManager.readImage(imageId)
          if (imageData) {
            const files = fs.readdirSync(fileManager.imagesDir)
            const imageFile = files.find(f => f.startsWith(imageId))
            const ext = imageFile
              ? imageFile.replace(imageId, '').replace('.enc', '')
              : '.png'
            const imageFileName = `${imageId}${ext}`
            fs.writeFileSync(path.join(imagesDir, imageFileName), imageData)
            content = content.replace(match[0], `![${match[1]}](./images/${imageFileName})`)
          }
        } catch (err) {
          console.error(`Failed to export image ${imageId}:`, err)
        }
      }
    }

    const safeName = note.metadata.title.replace(/[<>:"/\\|?*]/g, '_')
    const mdPath = path.join(targetDir, `${safeName}.md`)
    fs.writeFileSync(mdPath, content, 'utf-8')
  }

  ipcMain.handle('notes:download', async (_event, id: string) => {
    const note = noteService.get(id)
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return

    const result = await dialog.showSaveDialog(win, {
      title: '下载笔记',
      defaultPath: `${note.metadata.title}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })

    if (!result.canceled && result.filePath) {
      const targetDir = path.dirname(result.filePath)
      exportNoteWithImages(id, targetDir)
    }
  })

  ipcMain.handle('notes:batchExport', async (_event, directoryId?: string) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, message: '窗口未找到' }

    const result = await dialog.showOpenDialog(win, {
      title: '选择导出目录',
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: '导出到此目录',
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: '已取消' }
    }

    const exportRoot = result.filePaths[0]

    try {
      const allDirs = directoryService.list()
      const allNotes = noteService.list()

      const getDirPath = (dirId: string): string => {
        const parts: string[] = []
        let currentId: string | null = dirId
        while (currentId) {
          const dir = allDirs.find(d => d.id === currentId)
          if (!dir) break
          parts.unshift(dir.name.replace(/[<>:"/\\|?*]/g, '_'))
          currentId = dir.parentId
        }
        return parts.join(path.sep)
      }

      let dirsToExport: typeof allDirs
      if (directoryId) {
        const getDescendantIds = (parentId: string): string[] => {
          const children = allDirs.filter(d => d.parentId === parentId)
          const ids = [parentId]
          for (const child of children) {
            ids.push(...getDescendantIds(child.id))
          }
          return ids
        }
        const dirIds = new Set(getDescendantIds(directoryId))
        dirsToExport = allDirs.filter(d => dirIds.has(d.id))
      } else {
        dirsToExport = allDirs
      }

      let exportedCount = 0

      for (const dir of dirsToExport) {
        const dirPath = path.join(exportRoot, getDirPath(dir.id))
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true })
        }

        const dirNotes = allNotes.filter(n => n.directoryId === dir.id)
        for (const noteMeta of dirNotes) {
          exportNoteWithImages(noteMeta.id, dirPath)
          exportedCount++
        }
      }

      return {
        success: true,
        message: `导出完成！共导出 ${exportedCount} 篇笔记到 ${exportRoot}`,
      }
    } catch (error) {
      return {
        success: false,
        message: `导出失败: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  })

  ipcMain.handle('notes:exportPdf', async (_event, id: string, htmlContent: string) => {
    const note = noteService.get(id)
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return

    const result = await dialog.showSaveDialog(win, {
      title: '导出为PDF',
      defaultPath: `${note.metadata.title}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })

    if (!result.canceled && result.filePath) {
      await pdfService.exportToPdf(htmlContent, result.filePath)
    }
  })

  // ========== Directories ==========

  ipcMain.handle('directories:list', async () => {
    return directoryService.list()
  })

  ipcMain.handle('directories:create', async (_event, parentId: string | null, name: string) => {
    return directoryService.create(parentId, name)
  })

  ipcMain.handle('directories:rename', async (_event, id: string, name: string) => {
    directoryService.rename(id, name)
  })

  // Delete directory now moves to trash
  ipcMain.handle('directories:delete', async (_event, id: string) => {
    trashService.trashDirectory(id)
    return true
  })

  ipcMain.handle('directories:getLevel', async (_event, id: string) => {
    return directoryService.getLevelById(id)
  })

  // ========== Tags ==========

  ipcMain.handle('tags:list', async () => {
    return tagService.list()
  })

  ipcMain.handle('tags:create', async (_event, name: string, color: string) => {
    return tagService.create(name, color)
  })

  ipcMain.handle('tags:delete', async (_event, id: string) => {
    return tagService.delete(id)
  })

  ipcMain.handle('tags:assign', async (_event, noteId: string, tagIds: string[]) => {
    tagService.assign(noteId, tagIds)
  })

  ipcMain.handle('tags:getNotesForTag', async (_event, tagId: string) => {
    return tagService.getNotesForTag(tagId)
  })

  // ========== Versions ==========

  ipcMain.handle('versions:list', async (_event, noteId: string) => {
    return versionService.list(noteId)
  })

  ipcMain.handle('versions:get', async (_event, noteId: string, timestamp: string) => {
    return versionService.get(noteId, timestamp)
  })

  ipcMain.handle('versions:save', async (_event, noteId: string) => {
    versionService.save(noteId)
  })

  // ========== Search ==========

  ipcMain.handle('search:global', async (_event, query: string, directoryIds?: string[], totalLimit?: number) => {
    return searchService.global(query, directoryIds, totalLimit)
  })

  ipcMain.handle('search:inNote', async (_event, noteId: string, query: string) => {
    return searchService.inNote(noteId, query)
  })

  // ========== Images ==========

  ipcMain.handle('images:save', async (_event, _noteId: string, imageDataBase64: string, fileName: string) => {
    const ext = path.extname(fileName) || '.png'
    const imageData = Buffer.from(imageDataBase64, 'base64')
    const imageId = fileManager.saveImage(imageData, ext)
    return imageId
  })

  ipcMain.handle('images:get', async (_event, imageId: string) => {
    const imageData = fileManager.readImage(imageId)
    if (!imageData) return null
    const mimeType = fileManager.getImageMimeType(imageId)
    return `data:${mimeType};base64,${imageData.toString('base64')}`
  })

  ipcMain.handle('images:selectAndSave', async (_event, _noteId: string) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null

    const result = await dialog.showOpenDialog(win, {
      title: '选择图片',
      filters: [
        { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'] },
      ],
      properties: ['openFile'],
    })

    if (result.canceled || result.filePaths.length === 0) return null

    const filePath = result.filePaths[0]
    const ext = path.extname(filePath)
    const imageData = fs.readFileSync(filePath)
    const imageId = fileManager.saveImage(imageData, ext)
    return imageId
  })

  // ========== Trash / Recycle Bin ==========

  ipcMain.handle('trash:list', async () => {
    return trashService.list()
  })

  ipcMain.handle('trash:restore', async (_event, id: string, type: 'directory' | 'note') => {
    if (type === 'note') {
      trashService.restoreNote(id)
      searchService.upsertNote(id)
    } else {
      trashService.restoreDirectory(id)
      const notes = noteService.list()
      for (const note of notes) {
        searchService.upsertNote(note.id)
      }
    }
  })

  ipcMain.handle('trash:deletePermanently', async (_event, id: string, type: 'directory' | 'note') => {
    if (type === 'note') {
      trashService.deletePermanentlyNote(id)
    } else {
      trashService.deletePermanentlyDirectory(id)
    }
  })

  ipcMain.handle('trash:empty', async () => {
    trashService.emptyTrash()
  })

  ipcMain.handle('trash:getNoteContent', async (_event, noteId: string) => {
    return trashService.getNoteContent(noteId)
  })

  ipcMain.handle('trash:listVersions', async (_event, noteId: string) => {
    return trashService.listVersions(noteId)
  })

  ipcMain.handle('trash:getVersion', async (_event, noteId: string, timestamp: string) => {
    return trashService.getVersion(noteId, timestamp)
  })

  // ========== Import ==========

  ipcMain.handle('import:importMd', async (_event, directoryId: string) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, message: '窗口未找到' }

    const result = await dialog.showOpenDialog(win, {
      title: '导入 Markdown 文件',
      filters: [
        { name: 'Markdown', extensions: ['md', 'markdown', 'txt'] },
      ],
      properties: ['openFile', 'multiSelections'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: '已取消' }
    }

    try {
      let lastNoteId = ''
      for (const filePath of result.filePaths) {
        const note = importService.importMdFile(filePath, directoryId)
        searchService.upsertNote(note.id)
        lastNoteId = note.id
      }
      return {
        success: true,
        noteId: lastNoteId,
        message: `成功导入 ${result.filePaths.length} 个文件`,
      }
    } catch (error) {
      return {
        success: false,
        message: `导入失败: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  })

  ipcMain.handle('import:importPdf', async (_event, directoryId: string) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, message: '窗口未找到' }

    const result = await dialog.showOpenDialog(win, {
      title: '导入 PDF 文件',
      filters: [
        { name: 'PDF 文件', extensions: ['pdf', 'PDF'] },
        { name: '所有文件', extensions: ['*'] },
      ],
      properties: ['openFile', 'multiSelections'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: '已取消' }
    }

    try {
      let lastNoteId = ''
      for (const filePath of result.filePaths) {
        const note = await importService.importPdfFile(filePath, directoryId)
        searchService.upsertNote(note.id)
        lastNoteId = note.id
      }
      return {
        success: true,
        noteId: lastNoteId,
        message: `成功导入 ${result.filePaths.length} 个 PDF 文件`,
      }
    } catch (error) {
      return {
        success: false,
        message: `导入失败: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  })

  // ========== Sync ==========

  ipcMain.handle('sync:configure', async (_event, config) => {
    fileManager.updateSyncConfig(config)
    await syncService.configure(config)
  })

  ipcMain.handle('sync:auto-response', async (_event, response: { ok: boolean }) => {
    settleAutoSyncRequest(response.ok)
  })

  ipcMain.handle('sync:getConfig', async () => {
    return syncService.getConfig() || {
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
    }
  })

  ipcMain.handle('sync:push', async () => {
    const result = await syncService.push()
    if (result.status === 'success') {
      reloadDataCaches()
    }
    return result
  })

  ipcMain.handle('sync:pull', async () => {
    const result = await syncService.pull()
    if (result.status === 'success') {
      reloadDataCaches()
    }
    return result
  })

  ipcMain.handle('sync:getStatus', async () => {
    return await syncService.getStatus()
  })

  ipcMain.handle('sync:resolveConflicts', async (_event, resolutions: Array<{ file: string; resolution: 'local' | 'remote' }>) => {
    const result = await syncService.resolveConflicts(resolutions)
    if (result.status === 'success') {
      reloadDataCaches()
    }
    return result
  })

  // Return cleanup function
  return () => {
    noteService.cleanup()
    syncService.cleanup()
    settleAutoSyncRequest(false)
  }
}
