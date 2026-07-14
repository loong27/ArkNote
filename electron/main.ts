import { app, BrowserWindow, Menu, Tray, protocol, nativeImage, ipcMain, shell } from 'electron'
import path from 'path'
import { AppConfig } from './services/appConfig'
import { registerIpcHandlers } from './ipc/handlers'

// Initialize app config (reads data dir from ~/.zz-note-config.json)
const appConfig = new AppConfig()

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let cleanup: (() => void) | null = null
let isQuitting = false
let pendingQuitResolver: ((ok: boolean) => void) | null = null

async function requestRendererFlush(reason: 'quit' | 'restart'): Promise<boolean> {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return true
  }

  const approved = await new Promise<boolean>((resolve) => {
    pendingQuitResolver = resolve
    mainWindow?.webContents.send('window:quit-requested')

    setTimeout(() => {
      if (pendingQuitResolver) {
        console.warn(`${reason === 'restart' ? 'Restart' : 'Tray quit'} flush timeout, forcing ${reason}`)
        pendingQuitResolver = null
        resolve(true)
      }
    }, 10000)
  })

  if (!approved) {
    console.warn(`${reason === 'restart' ? 'Restart' : 'Tray quit'} cancelled because pending saves could not be flushed`)
  }

  return approved
}

function createWindow() {
  const bounds = appConfig.getWindowBounds()

  // Remove default application menu entirely
  Menu.setApplicationMenu(null)

  // Load icon.png for window icon
  const windowIcon = nativeImage.createFromPath(path.join(__dirname, '../../icon.png'))

  mainWindow = new BrowserWindow({
    width: bounds?.width || 1400,
    height: bounds?.height || 900,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 900,
    minHeight: 600,
    title: 'ZZ-Note',
    icon: windowIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
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
      mainWindow?.hide()
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
  // Load the app icon from the project root
  const iconPath = path.join(__dirname, '../../icon.png')
  let trayIcon = nativeImage.createFromPath(iconPath)

  // Resize for tray (16x16 on macOS/Windows, 24x24 on Linux)
  const iconSize = process.platform === 'linux' ? 24 : 16
  trayIcon = trayIcon.resize({ width: iconSize, height: iconSize })

  tray = new Tray(trayIcon)
  tray.setToolTip('ZZ-Note')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      },
    },
    { type: 'separator' },
    {
      label: '退出',
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
  protocol.registerBufferProtocol('zznote', async (_request, callback) => {
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
  ipcMain.handle('window:close-action', (_event, action: 'minimize' | 'quit', remember: boolean) => {
    if (remember) {
      appConfig.setCloseAction(action)
    }

    if (action === 'minimize') {
      mainWindow?.hide()
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
}

app.whenReady().then(() => {
  // Read data dir from config
  const dataDir = appConfig.getDataDir()

  // Register IPC handlers with configurable data dir
  cleanup = registerIpcHandlers(dataDir, appConfig, requestRestartFromRenderer)

  // Register window control IPC handlers
  registerWindowIpc()

  // Register custom protocol
  registerImageProtocol()

  // Create system tray
  createTray()

  // Create window
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      mainWindow?.show()
    }
  })
})

app.on('window-all-closed', () => {
  if (cleanup) {
    cleanup()
  }

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  isQuitting = true
  if (cleanup) {
    cleanup()
  }
})
