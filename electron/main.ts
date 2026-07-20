import { app, BrowserWindow, Menu, Tray, protocol, nativeImage, ipcMain, shell } from 'electron'
import path from 'path'
import { AppConfig } from './services/appConfig'
import { registerIpcHandlers } from './ipc/handlers'
import type { IpcHandlerController } from './ipc/handlers'
import { UpdateService } from './services/updateService'
import { translate } from '../shared/i18n'

const APP_ID = 'com.arknote.app'
const LINUX_WM_CLASS = 'ark-note'

if (process.platform === 'win32') {
  app.setAppUserModelId(APP_ID)
}

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('class', LINUX_WM_CLASS)
}

// Initialize app config (reads data dir from ~/.ark-note-config.json)
const appConfig = new AppConfig()

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let ipcController: IpcHandlerController | null = null
let updateService: UpdateService | null = null
let isQuitting = false
let pendingQuitResolver: ((ok: boolean) => void) | null = null

async function lockVaultForBackground(): Promise<boolean> {
  if (!appConfig.getSecurityConfig().lockOnMinimize) return true
  if (!(await requestRendererFlush('lock'))) return false
  ipcController?.lockVault()
  mainWindow?.webContents.send('auth:locked')
  return true
}

function getIconPath(size?: 16 | 24): string {
  const fileName = size
    ? `${size}x${size}.png`
    : process.platform === 'win32'
      ? 'icon.ico'
      : '512x512.png'

  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'icons', fileName)
  }

  if (fileName === 'icon.ico') {
    return path.join(app.getAppPath(), 'public', fileName)
  }

  return path.join(app.getAppPath(), 'build', 'icons', fileName)
}

function loadIcon(size?: 16 | 24) {
  const iconPath = getIconPath(size)
  const icon = nativeImage.createFromPath(iconPath)

  if (icon.isEmpty()) {
    console.error(`Failed to load application icon: ${iconPath}`)
  }

  return icon
}

async function requestRendererFlush(reason: 'quit' | 'restart' | 'lock'): Promise<boolean> {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return true
  }

  const approved = await new Promise<boolean>((resolve) => {
    pendingQuitResolver = resolve
    mainWindow?.webContents.send('window:quit-requested')

    setTimeout(() => {
      if (pendingQuitResolver) {
        const action = reason === 'restart' ? 'Restart' : reason === 'lock' ? 'Background lock' : 'Tray quit'
        console.warn(`${action} flush timeout, ${reason === 'lock' ? 'cancelling lock' : `forcing ${reason}`}`)
        pendingQuitResolver = null
        resolve(reason !== 'lock')
      }
    }, 10000)
  })

  if (!approved) {
    const action = reason === 'restart' ? 'Restart' : reason === 'lock' ? 'Background lock' : 'Tray quit'
    console.warn(`${action} cancelled because pending saves could not be flushed`)
  }

  return approved
}

function createWindow() {
  const bounds = appConfig.getWindowBounds()

  // Remove default application menu entirely
  Menu.setApplicationMenu(null)

  const windowIcon = loadIcon()

  mainWindow = new BrowserWindow({
    width: bounds?.width || 1400,
    height: bounds?.height || 900,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 900,
    minHeight: 600,
    title: 'arkNote',
    icon: windowIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    // Frameless + no shadow for pure custom window
    frame: false,
    titleBarStyle: 'default',
    hasShadow: false,
    backgroundColor: '#00000000',
    transparent: false,
    show: false,
  })

  // Show window once ready to avoid white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  // Handle close button behavior
  mainWindow.on('close', (e) => {
    if (mainWindow) {
      // Always save window bounds
      const bounds = mainWindow.getBounds()
      appConfig.setWindowBounds(bounds)
    }

    // If the app is quitting (e.g. from tray "Quit"), let it close
    if (isQuitting) return

    const closeAction = appConfig.getCloseAction()

    if (closeAction === 'minimize') {
      // User previously chose to minimize to tray
      e.preventDefault()
      void lockVaultForBackground().then((locked) => {
        if (locked) mainWindow?.hide()
      })
      return
    }

    if (closeAction === 'quit') {
      // User previously chose to quit directly
      return // let it close
    }

    // closeAction === 'ask': let the renderer show the dialog
    e.preventDefault()
    mainWindow?.webContents.send('window:close-requested')

    // Safety timeout: if renderer doesn't respond in 10 seconds, force quit
    setTimeout(() => {
      if (mainWindow && !isQuitting) {
        console.warn('Close dialog timeout, forcing quit')
        isQuitting = true
        app.quit()
      }
    }, 10000)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.on('minimize', () => {
    void lockVaultForBackground().then((locked) => {
      if (!locked) {
        mainWindow?.restore()
        mainWindow?.show()
      }
    })
  })

  // Notify renderer of maximize/unmaximize state changes
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximized-changed', true)
  })
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximized-changed', false)
  })
}

async function requestQuitFromRenderer() {
  if (!(await requestRendererFlush('quit'))) {
    return
  }

  isQuitting = true
  app.quit()
}

async function requestRestartFromRenderer() {
  if (!(await requestRendererFlush('restart'))) {
    return
  }

  isQuitting = true
  app.relaunch()
  app.exit(0)
}

function createTray() {
  const iconSize = process.platform === 'linux' ? 24 : 16
  const trayIcon = loadIcon(iconSize)

  tray = new Tray(trayIcon)
  tray.setToolTip('arkNote')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: translate(appConfig.getLanguage(), '显示窗口'),
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      },
    },
    { type: 'separator' },
    {
      label: translate(appConfig.getLanguage(), '退出'),
      click: () => {
        void requestQuitFromRenderer()
      },
    },
  ])
  tray.setContextMenu(contextMenu)

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

// Register custom protocol for serving encrypted images
function registerImageProtocol() {
  protocol.registerBufferProtocol('arknote', async (_request, callback) => {
    try {
      callback({ statusCode: 404 })
    } catch {
      callback({ statusCode: 500 })
    }
  })
}

// ========== Window control IPC handlers ==========
function registerWindowIpc() {
  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize()
  })

  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })

  ipcMain.handle('window:isMaximized', () => {
    return mainWindow?.isMaximized() ?? false
  })

  // Called when user chooses action from the close dialog in renderer
  ipcMain.handle('window:close-action', async (_event, action: 'minimize' | 'quit', remember: boolean) => {
    if (remember) {
      appConfig.setCloseAction(action)
    }

    if (action === 'minimize') {
      if (await lockVaultForBackground()) {
        mainWindow?.hide()
      }
    } else {
      isQuitting = true
      mainWindow?.close()
    }
  })

  ipcMain.handle('window:get-close-action', () => {
    return appConfig.getCloseAction()
  })

  ipcMain.handle('window:quit-response', (_event, response: { ok: boolean }) => {
    if (pendingQuitResolver) {
      const resolver = pendingQuitResolver
      pendingQuitResolver = null
      resolver(response.ok)
    }
  })

  ipcMain.handle('window:set-close-action', (_event, action: 'ask' | 'minimize' | 'quit') => {
    appConfig.setCloseAction(action)
  })

  ipcMain.handle('window:openExternal', async (_event, url: string) => {
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      await shell.openExternal(url)
    }
  })

  ipcMain.on('config:language-changed', () => {
    tray?.destroy()
    tray = null
    createTray()
  })
}

app.whenReady().then(() => {
  // Read data dir from config
  const dataDir = appConfig.getDataDir()

  // Register IPC handlers with configurable data dir
  ipcController = registerIpcHandlers(dataDir, appConfig, requestRestartFromRenderer)

  // Register window control IPC handlers
  registerWindowIpc()

  updateService = new UpdateService(async () => {
    if (!(await requestRendererFlush('restart'))) return false
    isQuitting = true
    return true
  })
  updateService.registerIpcHandlers()

  // Register custom protocol
  registerImageProtocol()

  // Create system tray
  createTray()

  // Create window
  createWindow()

  updateService.start()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      mainWindow?.show()
    }
  })
})

app.on('window-all-closed', () => {
  ipcController?.cleanup()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  isQuitting = true
  updateService?.cleanup()
  ipcController?.cleanup()
})
