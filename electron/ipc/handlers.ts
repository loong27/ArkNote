import { ipcMain, dialog, BrowserWindow, clipboard, nativeImage, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { EncryptionService, VaultIntegrityError } from '../services/encryption'
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
import { VaultRestoreService } from '../services/vaultRestoreService'
import { VaultBackupService } from '../services/vaultBackupService'
import { ColdBackupService } from '../services/coldBackupService'
import { migrateLegacyBrandReferences } from '../../shared/brand'
import {
  collectArkNoteImageIds,
  replaceArkNoteImages,
} from '../../shared/inlineArkNoteImages'
import { translate } from '../../shared/i18n'
import {
  AuthAttemptLimiter,
  createVaultAuthKey,
  validateNewPassword,
  validatePasswordInput,
} from '../services/authSecurity'

export interface IpcHandlerController {
  cleanup: () => void
  lockVault: () => void
}

export function registerIpcHandlers(
  dataDir: string,
  appConfig: AppConfig,
  restartApp: () => Promise<void>
): IpcHandlerController {
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
  const vaultRestoreService = new VaultRestoreService(dataDir, {
    getHttpsToken: () => appConfig.getGitHttpsToken(),
  })
  const vaultBackupService = new VaultBackupService(dataDir, encryption, fileManager)
  const coldBackupService = new ColdBackupService(appConfig, dataDir, encryption, fileManager)
  let pendingAutoSyncResolver: ((ok: boolean) => void) | null = null
  let pendingAutoSyncTimeout: NodeJS.Timeout | null = null
  const authLimiter = new AuthAttemptLimiter(createVaultAuthKey(dataDir), appConfig)
  const tr = (source: string) => translate(appConfig.getLanguage(), source)

  const reloadDataCaches = () => {
    fileManager.clearCache()
    searchService.clearCache()
    fileManager.loadMetadata()
    trashService.clearCache()
  }

  const rateLimitResult = (retryAfterMs: number, failedAttempts: number) => ({
    success: false,
    error: 'rate_limited' as const,
    message: `尝试次数过多，请在 ${Math.max(1, Math.ceil(retryAfterMs / 1000))} 秒后重试`,
    retryAfterMs,
    failedAttempts,
  })

  const invalidPasswordResult = (retryAfterMs: number, failedAttempts: number) => ({
    success: false,
    error: 'invalid_password' as const,
    message: retryAfterMs > 0
      ? `密码错误，请在 ${Math.max(1, Math.ceil(retryAfterMs / 1000))} 秒后重试`
      : '密码错误，请重试',
    retryAfterMs,
    failedAttempts,
  })

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
    getHttpsToken: () => appConfig.getGitHttpsToken(),
    fileManager,
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

  const lockVault = () => {
    noteService.cleanup()
    syncService.cleanup()
    coldBackupService.stopScheduler()
    settleAutoSyncRequest(false)
    fileManager.clearCache()
    searchService.clearCache()
    trashService.clearCache()
    encryption.lock()
  }

  // ========== Auth ==========

  ipcMain.handle('auth:unlock', async (_event, password: string) => {
    return authLimiter.runExclusive(async () => {
      const isFirstTime = encryption.isFirstTime()
      const throttle = authLimiter.getStatus()
      if (throttle.retryAfterMs > 0) {
        return { ...rateLimitResult(throttle.retryAfterMs, throttle.failedAttempts), isFirstTime }
      }

      const inputValidation = validatePasswordInput(password)
      if (!inputValidation.valid) {
        const failed = authLimiter.recordFailure()
        return { ...invalidPasswordResult(failed.retryAfterMs, failed.failedAttempts), isFirstTime }
      }

      if (isFirstTime) {
        const passwordValidation = validateNewPassword(password)
        if (!passwordValidation.valid) {
          return {
            success: false,
            isFirstTime,
            error: 'weak_password' as const,
            message: passwordValidation.message,
            retryAfterMs: 0,
            failedAttempts: 0,
          }
        }
      }

      try {
        const success = await encryption.unlock(password)
        if (!success) {
          const failed = authLimiter.recordFailure()
          return { ...invalidPasswordResult(failed.retryAfterMs, failed.failedAttempts), isFirstTime }
        }

        fileManager.ensureDirectories()
        fileManager.loadMetadata()
        trashService.ensureTrashDirs()

        const meta = fileManager.getMetadata()
        if (meta.syncConfig.enabled) {
          syncService.configure(meta.syncConfig).catch(console.error)
        }
        coldBackupService.startScheduler()

        if (isFirstTime) {
          appConfig.setRecoveryTipPending(true)
        }

        authLimiter.reset()
        return {
          success: true,
          isFirstTime,
          retryAfterMs: 0,
          failedAttempts: 0,
        }
      } catch (error) {
        encryption.lock()
        if (error instanceof VaultIntegrityError) {
          return {
            success: false,
            isFirstTime,
            error: 'vault_integrity' as const,
            message: error.message,
            retryAfterMs: 0,
            failedAttempts: throttle.failedAttempts,
          }
        }
        return {
          success: false,
          isFirstTime,
          error: 'unlock_failed' as const,
          message: '解锁失败，请检查数据目录后重试',
          retryAfterMs: 0,
          failedAttempts: throttle.failedAttempts,
        }
      }
    })
  })

  ipcMain.handle('auth:getUnlockStatus', async () => authLimiter.getStatus())

  ipcMain.handle('auth:restoreFromGit', async (_event, request) => {
    return authLimiter.runExclusive(async () => {
      if (!encryption.isFirstTime()) {
        return { success: false, message: '本地已有加密数据，不能执行首次恢复' }
      }

      if (typeof request?.httpsToken === 'string' && request.httpsToken.trim()) {
        appConfig.setGitHttpsToken(request.httpsToken.trim())
      }
      const result = await vaultRestoreService.restore({
        repoUrl: typeof request?.repoUrl === 'string' ? request.repoUrl : '',
        branch: typeof request?.branch === 'string' ? request.branch : 'main',
        httpsToken: appConfig.getGitHttpsToken(),
      })
      if (result.success) authLimiter.reset()
      return result
    })
  })

  ipcMain.handle('auth:lock', async () => {
    lockVault()
  })

  ipcMain.handle('auth:isLocked', async () => {
    return encryption.isLocked()
  })

  ipcMain.handle('auth:isFirstTime', async () => {
    return encryption.isFirstTime()
  })

  ipcMain.handle('auth:changePassword', async (_event, oldPassword: string, newPassword: string) => {
    return authLimiter.runExclusive(async () => {
      const throttle = authLimiter.getStatus()
      if (throttle.retryAfterMs > 0) {
        return rateLimitResult(throttle.retryAfterMs, throttle.failedAttempts)
      }

      const oldPasswordValidation = validatePasswordInput(oldPassword)
      const newPasswordValidation = validateNewPassword(newPassword)
      if (!newPasswordValidation.valid) {
        return {
          success: false,
          error: 'weak_password' as const,
          message: newPasswordValidation.message,
          retryAfterMs: 0,
          failedAttempts: throttle.failedAttempts,
        }
      }
      if (!oldPasswordValidation.valid) {
        const failed = authLimiter.recordFailure()
        return invalidPasswordResult(failed.retryAfterMs, failed.failedAttempts)
      }

      const success = await encryption.changePassword(oldPassword, newPassword)
      if (!success) {
        const failed = authLimiter.recordFailure()
        return invalidPasswordResult(failed.retryAfterMs, failed.failedAttempts)
      }

      fileManager.clearCache()
      searchService.clearCache()
      fileManager.loadMetadata()
      trashService.clearCache()
      authLimiter.reset()
      return {
        success: true,
        retryAfterMs: 0,
        failedAttempts: 0,
      }
    })
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
      title: tr('选择数据存储目录'),
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: tr('选择此目录'),
    })

    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('config:inspectDataDir', async (_event, dir: string) => {
    return appConfig.inspectDataDir(dir)
  })

  ipcMain.handle('config:getAll', async () => {
    const security = appConfig.getSecurityConfig()
    const editor = appConfig.getEditorPrefs()
    return {
      dataDir: appConfig.getDataDir(),
      defaultDataDir: AppConfig.getDefaultDataDir(),
      configPath: AppConfig.getConfigPath(),
      theme: appConfig.getTheme(),
      language: appConfig.getLanguage(),
      sidebarWidth: appConfig.getSidebarWidth(),
      autoLockMinutes: security.autoLockMinutes,
      lockOnMinimize: security.lockOnMinimize,
      editorFontSize: editor.fontSize,
      editorDefaultView: editor.defaultView,
      pinnedNoteIds: appConfig.getPinnedNoteIds(),
      recentNoteIds: appConfig.getRecentNoteIds(),
      recoveryTipPending: appConfig.getRecoveryTipPending(),
    }
  })

  ipcMain.handle('config:getSecurity', async () => appConfig.getSecurityConfig())

  ipcMain.handle('config:setSecurity', async (_event, config) => {
    return appConfig.setSecurityConfig(config)
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

  ipcMain.handle('config:getLanguage', async () => appConfig.getLanguage())

  ipcMain.handle('config:setLanguage', async (_event, language) => {
    appConfig.setLanguage(language)
    ipcMain.emit('config:language-changed')
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('config:language-changed')
    }
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

  ipcMain.handle(
    'notes:move',
    async (_event, id: string, targetDirectoryId: string, beforeId?: string | null) => {
      noteService.move(id, targetDirectoryId, beforeId)
      searchService.upsertNote(id)
    },
  )

  /** Resolve arknote:// image refs in markdown to data URLs for external use. */
  const inlineImagesAsBase64 = (content: string): string => {
    const migrated = migrateLegacyBrandReferences(content)
    const imageIds = collectArkNoteImageIds(migrated)
    if (imageIds.length === 0) return migrated

    const idToDataUrl = new Map<string, string>()
    for (const imageId of imageIds) {
      try {
        const imageData = fileManager.readImage(imageId)
        if (!imageData) continue
        const mimeType = fileManager.getImageMimeType(imageId)
        idToDataUrl.set(imageId, `data:${mimeType};base64,${imageData.toString('base64')}`)
      } catch (err) {
        console.error(`Failed to inline image ${imageId}:`, err)
      }
    }

    return replaceArkNoteImages(migrated, idToDataUrl)
  }

  // Helper: export a single note as a self-contained .md (images as Base64 data URLs)
  const exportNoteWithImages = (noteId: string, targetDir: string) => {
    const note = noteService.get(noteId)
    const content = inlineImagesAsBase64(note.content)

    const safeName = note.metadata.title.replace(/[<>:"/\\|?*]/g, '_')
    const mdPath = path.join(targetDir, `${safeName}.md`)
    fs.writeFileSync(mdPath, content, 'utf-8')
  }

  ipcMain.handle('notes:download', async (_event, id: string) => {
    const note = noteService.get(id)
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return

    const result = await dialog.showSaveDialog(win, {
      title: tr('下载笔记'),
      defaultPath: `${note.metadata.title}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })

    if (!result.canceled && result.filePath) {
      const content = inlineImagesAsBase64(note.content)
      fs.writeFileSync(result.filePath, content, 'utf-8')
    }
  })

  ipcMain.handle('notes:batchExport', async (_event, directoryId?: string) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, message: '窗口未找到' }

    const result = await dialog.showOpenDialog(win, {
      title: tr('选择导出目录'),
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: tr('导出到此目录'),
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

  const SHARE_SLOGAN_ZH = '安全加密的跨平台笔记'
  const buildSharePayload = (title: string, htmlContent: string) => ({
    title,
    bodyHtml: typeof htmlContent === 'string' ? htmlContent : '',
    slogan: tr(SHARE_SLOGAN_ZH),
  })

  ipcMain.handle('notes:exportPdf', async (_event, id: string, htmlContent: string, title?: string) => {
    const note = noteService.get(id)
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return

    const result = await dialog.showSaveDialog(win, {
      title: tr('导出为PDF'),
      defaultPath: `${note.metadata.title}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })

    if (!result.canceled && result.filePath) {
      await pdfService.exportToPdf(
        buildSharePayload(title || note.metadata.title, htmlContent),
        result.filePath,
      )
    }
  })

  ipcMain.handle('notes:renderShareImage', async (_event, id: string, htmlContent: string, title?: string) => {
    const note = noteService.get(id)
    try {
      const png = await pdfService.exportToPng(
        buildSharePayload(title || note.metadata.title, htmlContent),
      )
      return {
        success: true,
        dataUrl: `data:image/png;base64,${png.toString('base64')}`,
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      }
    }
  })

  ipcMain.handle('notes:saveShareImage', async (_event, dataUrl: string, defaultName?: string) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { success: false, message: '窗口未找到' }

    const safeName = (defaultName || 'note').replace(/[<>:"/\\|?*]/g, '_')
    const result = await dialog.showSaveDialog(win, {
      title: tr('保存图片'),
      defaultPath: `${safeName}.png`,
      filters: [{ name: 'PNG', extensions: ['png'] }],
    })

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true }
    }

    try {
      const base64 = String(dataUrl || '').replace(/^data:image\/png;base64,/, '')
      fs.writeFileSync(result.filePath, Buffer.from(base64, 'base64'))
      return { success: true, filePath: result.filePath }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      }
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

  ipcMain.handle(
    'directories:move',
    async (_event, id: string, targetParentId: string | null, beforeId?: string | null) => {
      return directoryService.move(id, targetParentId, beforeId)
    },
  )

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

  ipcMain.handle('tags:rename', async (_event, id: string, name: string) => {
    return tagService.rename(id, name)
  })

  ipcMain.handle('tags:delete', async (_event, id: string, removeFromNotes?: boolean) => {
    return tagService.delete(id, Boolean(removeFromNotes))
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

  ipcMain.handle('versions:diff', async (_event, noteId: string, timestamp: string) => {
    return versionService.diff(noteId, timestamp)
  })

  ipcMain.handle('versions:prune', async (_event, noteId?: string) => {
    return versionService.prune(noteId)
  })

  // ========== Search ==========

  ipcMain.handle('search:global', async (_event, query: string, directoryIds?: string[], totalLimit?: number, tagIds?: string[], offset?: number) => {
    return searchService.global(query, directoryIds, totalLimit, tagIds, offset)
  })

  ipcMain.handle('search:byTitle', async (_event, query: string, limit?: number) => {
    return searchService.byTitle(query, limit)
  })

  ipcMain.handle('search:inNote', async (_event, noteId: string, query: string) => {
    return searchService.inNote(noteId, query)
  })

  ipcMain.handle('search:backlinks', async (_event, noteId: string) => {
    return searchService.backlinks(noteId)
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

  ipcMain.handle('images:inlineInMarkdown', async (_event, content: string) => {
    if (typeof content !== 'string') return ''
    return inlineImagesAsBase64(content)
  })

  ipcMain.handle('images:selectAndSave', async (_event, _noteId: string) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null

    const result = await dialog.showOpenDialog(win, {
      title: tr('选择图片'),
      filters: [
        { name: tr('图片'), extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'] },
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

  // ========== Clipboard ==========

  ipcMain.handle('clipboard:writeImage', async (_event, dataUrl: string) => {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      return { success: false, message: 'Invalid image data' }
    }

    try {
      const image = nativeImage.createFromDataURL(dataUrl)
      if (image.isEmpty()) {
        return { success: false, message: 'Empty image' }
      }
      clipboard.writeImage(image)
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, message }
    }
  })

  ipcMain.handle('clipboard:writeText', async (_event, text: string) => {
    if (typeof text !== 'string') {
      return { success: false, message: 'Invalid text' }
    }
    try {
      clipboard.writeText(text)
      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, message }
    }
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
      title: tr('导入 Markdown 文件'),
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
        const note = importService.importMdFile(filePath, directoryId, appConfig.getLanguage())
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
      title: tr('导入 PDF 文件'),
      filters: [
        { name: tr('PDF 文件'), extensions: ['pdf', 'PDF'] },
        { name: tr('所有文件'), extensions: ['*'] },
      ],
      properties: ['openFile', 'multiSelections'],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: '已取消' }
    }

    try {
      let lastNoteId = ''
      for (const filePath of result.filePaths) {
        const note = await importService.importPdfFile(filePath, directoryId, appConfig.getLanguage())
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
    if (typeof config?.httpsToken === 'string') {
      appConfig.setGitHttpsToken(config.httpsToken === '********' ? appConfig.getGitHttpsToken() : config.httpsToken)
    }
    const vaultConfig = fileManager.sanitizeSyncConfig(config || {})
    fileManager.updateSyncConfig(vaultConfig)
    await syncService.configure({
      ...vaultConfig,
      httpsToken: appConfig.getGitHttpsToken(),
    })
  })

  ipcMain.handle('sync:auto-response', async (_event, response: { ok: boolean }) => {
    settleAutoSyncRequest(response.ok)
  })

  ipcMain.handle('sync:getConfig', async () => {
    const base = syncService.getConfig() || fileManager.getMetadata().syncConfig || {
      enabled: false,
      provider: 'git' as const,
      repoUrl: '',
      branch: 'main',
      autoSync: false,
      syncInterval: 30,
    }
    return {
      ...base,
      provider: 'git' as const,
      httpsToken: appConfig.getGitHttpsToken() ? '********' : '',
    }
  })

  ipcMain.handle('sync:run', async () => {
    const result = await syncService.sync()
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

  // ========== Vault backup / integrity ==========

  ipcMain.handle('vault:exportBackup', async () => {
    return vaultBackupService.exportEncryptedArchive()
  })

  ipcMain.handle('vault:verifyIntegrity', async () => {
    return vaultBackupService.verifyIntegrity()
  })

  ipcMain.handle('vault:getRecoveryTipPending', async () => appConfig.getRecoveryTipPending())
  ipcMain.handle('vault:dismissRecoveryTip', async () => {
    appConfig.setRecoveryTipPending(false)
  })

  // ========== Import folder ==========

  ipcMain.handle('import:importFolder', async (_event, directoryId: string | null) => {
    const result = await dialog.showOpenDialog({
      title: tr('选择要导入的 Markdown 文件夹'),
      properties: ['openDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, imported: 0, message: '已取消' }
    }
    try {
      const { imported, noteIds } = importService.importMarkdownFolder(
        result.filePaths[0],
        directoryId,
        appConfig.getLanguage(),
        true,
      )
      for (const id of noteIds) searchService.upsertNote(id)
      return { success: true, imported, message: `成功导入 ${imported} 篇 Markdown 笔记` }
    } catch (error) {
      return {
        success: false,
        imported: 0,
        message: `导入失败: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  })

  // ========== Notes extras: pin/recent/templates/outline/attachments/time capsule ==========

  ipcMain.handle('notesExtras:getPinned', async () => appConfig.getPinnedNoteIds())
  ipcMain.handle('notesExtras:setPinned', async (_event, noteIds: string[]) => appConfig.setPinnedNoteIds(noteIds))
  ipcMain.handle('notesExtras:getRecent', async () => appConfig.getRecentNoteIds())
  ipcMain.handle('notesExtras:touchRecent', async (_event, noteId: string) => appConfig.touchRecentNote(noteId))
  ipcMain.handle('notesExtras:getEditorPrefs', async () => appConfig.getEditorPrefs())
  ipcMain.handle('notesExtras:setEditorPrefs', async (_event, prefs) => appConfig.setEditorPrefs(prefs || {}))

  ipcMain.handle('notesExtras:createFromTemplate', async (_event, directoryId: string, template: 'blank' | 'daily' | 'meeting') => {
    const language = appConfig.getLanguage()
    const today = new Date()
    const dateStr = today.toISOString().slice(0, 10)
    const titles = {
      blank: tr('未命名笔记'),
      daily: `${tr('日记')} ${dateStr}`,
      meeting: `${tr('会议记录')} ${dateStr}`,
    }
    const bodies = {
      blank: `# ${titles.blank}\n\n`,
      daily: `# ${titles.daily}\n\n## ${tr('今日要点')}\n\n- \n\n## ${tr('随记')}\n\n`,
      meeting: `# ${titles.meeting}\n\n## ${tr('参与人')}\n\n- \n\n## ${tr('议程')}\n\n1. \n\n## ${tr('结论')}\n\n`,
    }
    const note = noteService.create(directoryId, titles[template] || titles.blank)
    fileManager.writeNoteContent(note.id, bodies[template] || bodies.blank)
    searchService.upsertNote(note.id)
    return note
  })

  ipcMain.handle('notesExtras:getDailyNote', async () => {
    const language = appConfig.getLanguage()
    const dateStr = new Date().toISOString().slice(0, 10)
    const title = `${tr('日记')} ${dateStr}`
    const meta = fileManager.getMetadata()
    const existing = meta.notes.find(n => n.title === title)
    if (existing) return existing

    let journalDir = meta.directories.find(d => d.parentId === null && (d.name === '日记' || d.name === 'Journal'))
    if (!journalDir) {
      journalDir = directoryService.create(null, language === 'en-US' ? 'Journal' : '日记')
    }
    const note = noteService.create(journalDir.id, title)
    fileManager.writeNoteContent(note.id, `# ${title}\n\n## ${tr('今日要点')}\n\n- \n\n## ${tr('随记')}\n\n`)
    searchService.upsertNote(note.id)
    return note
  })

  ipcMain.handle('notesExtras:getOutline', async (_event, noteId: string) => {
    const content = fileManager.readNoteContent(noteId)
    const outline: Array<{ level: number; text: string; line: number }> = []
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const m = /^(#{1,3})\s+(.+)$/.exec(lines[i])
      if (m) outline.push({ level: m[1].length, text: m[2].trim(), line: i + 1 })
    }
    return outline
  })

  ipcMain.handle('notesExtras:listAttachments', async (_event, noteId: string) => {
    const content = fileManager.readNoteContent(noteId)
    return fileManager.listAttachmentsForNote(noteId, content)
  })

  ipcMain.handle('notesExtras:addAttachment', async (_event, noteId: string) => {
    const result = await dialog.showOpenDialog({
      title: tr('选择附件'),
      properties: ['openFile'],
      filters: [
        { name: 'Files', extensions: ['pdf', 'zip', 'txt', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'md'] },
      ],
    })
    if (result.canceled || !result.filePaths[0]) return null
    const filePath = result.filePaths[0]
    const data = fs.readFileSync(filePath)
    const saved = fileManager.saveAttachment(data, path.basename(filePath))
    const content = fileManager.readNoteContent(noteId)
    const link = `\n\n[📎 ${saved.name}](arknote-file://${saved.id})\n`
    fileManager.writeNoteContent(noteId, content + link)
    searchService.upsertNote(noteId)
    return { id: saved.id, name: saved.name, mime: 'application/octet-stream' }
  })

  ipcMain.handle('notesExtras:openAttachment', async (_event, attachmentId: string) => {
    const attachment = fileManager.readAttachment(attachmentId)
    if (!attachment) return { success: false, message: '附件不存在' }
    const tmp = path.join(os.tmpdir(), `arknote-att-${attachmentId}-${attachment.name}`)
    fs.writeFileSync(tmp, attachment.buffer)
    await shell.openPath(tmp)
    return { success: true }
  })

  ipcMain.handle('notesExtras:getTimeCapsule', async () => {
    const meta = fileManager.getMetadata()
    const buckets = new Map<string, { year: number; month: number; created: number; updated: number }>()
    for (const note of meta.notes) {
      const created = new Date(note.createdAt)
      const updated = new Date(note.updatedAt)
      const cKey = `${created.getFullYear()}-${created.getMonth() + 1}`
      const uKey = `${updated.getFullYear()}-${updated.getMonth() + 1}`
      if (!buckets.has(cKey)) {
        buckets.set(cKey, { year: created.getFullYear(), month: created.getMonth() + 1, created: 0, updated: 0 })
      }
      buckets.get(cKey)!.created += 1
      if (!buckets.has(uKey)) {
        buckets.set(uKey, { year: updated.getFullYear(), month: updated.getMonth() + 1, created: 0, updated: 0 })
      }
      buckets.get(uKey)!.updated += 1
    }
    return [...buckets.values()].sort((a, b) => b.year - a.year || b.month - a.month)
  })

  ipcMain.handle(
    'notesExtras:listByMonth',
    async (
      _event,
      request: { year: number; month: number; mode?: 'created' | 'updated' },
    ) => {
      const year = Number(request?.year)
      const month = Number(request?.month)
      const mode = request?.mode === 'updated' ? 'updated' : 'created'
      if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return []
      }
      const meta = fileManager.getMetadata()
      const notes = meta.notes
        .filter((note) => {
          const d = new Date(mode === 'updated' ? note.updatedAt : note.createdAt)
          return d.getFullYear() === year && d.getMonth() + 1 === month
        })
        .map((note) => ({
          id: note.id,
          title: note.title,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
        }))
        .sort((a, b) => {
          const ta = new Date(mode === 'updated' ? a.updatedAt : a.createdAt).getTime()
          const tb = new Date(mode === 'updated' ? b.updatedAt : b.createdAt).getTime()
          return tb - ta
        })
      return notes
    },
  )

  // ========== Cold backup ==========

  ipcMain.handle('coldBackup:getConfig', async () => coldBackupService.getConfig())
  ipcMain.handle('coldBackup:setConfig', async (_event, config) => coldBackupService.setConfig(config))
  ipcMain.handle('coldBackup:runNow', async () => coldBackupService.runNow())
  ipcMain.handle('coldBackup:testConnection', async () => coldBackupService.testConnection())
  ipcMain.handle('coldBackup:restoreFromFile', async () => coldBackupService.restoreFromFile())

  return {
    lockVault,
    cleanup: () => {
      lockVault()
    },
  }
}

