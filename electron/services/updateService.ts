import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater'
import type { AppUpdateState } from '../../src/types'

const INITIAL_CHECK_DELAY_MS = 12_000
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

export class UpdateService {
  private state: AppUpdateState = {
    phase: 'idle',
    currentVersion: app.getVersion(),
    availableVersion: null,
    progress: null,
    message: '尚未检查更新',
    checkedAt: null,
  }
  private initialCheckTimer: NodeJS.Timeout | null = null
  private checkInterval: NodeJS.Timeout | null = null
  private started = false

  constructor(private readonly beforeInstall: () => Promise<boolean>) {
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowPrerelease = false
  }

  registerIpcHandlers(): void {
    ipcMain.handle('updates:getState', () => this.getState())
    ipcMain.handle('updates:check', () => this.checkForUpdates())
    ipcMain.handle('updates:download', () => this.downloadUpdate())
    ipcMain.handle('updates:install', () => this.installUpdate())
  }

  start(): void {
    if (this.started) return
    this.started = true
    this.registerUpdaterEvents()

    const unsupportedReason = this.getUnsupportedReason()
    if (unsupportedReason) {
      this.setState({ phase: 'disabled', message: unsupportedReason })
      return
    }

    this.initialCheckTimer = setTimeout(() => {
      void this.checkForUpdates()
    }, INITIAL_CHECK_DELAY_MS)
    this.checkInterval = setInterval(() => {
      void this.checkForUpdates()
    }, CHECK_INTERVAL_MS)
  }

  cleanup(): void {
    if (this.initialCheckTimer) clearTimeout(this.initialCheckTimer)
    if (this.checkInterval) clearInterval(this.checkInterval)
    this.initialCheckTimer = null
    this.checkInterval = null
  }

  getState(): AppUpdateState {
    return { ...this.state }
  }

  async checkForUpdates(): Promise<AppUpdateState> {
    const unsupportedReason = this.getUnsupportedReason()
    if (unsupportedReason) {
      this.setState({ phase: 'disabled', message: unsupportedReason })
      return this.getState()
    }
    if (this.state.phase === 'checking' || this.state.phase === 'downloading') {
      return this.getState()
    }

    this.setState({ phase: 'checking', message: '正在检查 GitHub Release...' })
    try {
      await autoUpdater.checkForUpdates()
    } catch (error) {
      this.setError(error, '检查更新失败')
    }
    return this.getState()
  }

  async downloadUpdate(): Promise<AppUpdateState> {
    if (this.state.phase !== 'available') return this.getState()

    this.setState({ phase: 'downloading', progress: 0, message: '正在下载更新...' })
    try {
      await autoUpdater.downloadUpdate()
    } catch (error) {
      this.setError(error, '下载更新失败')
    }
    return this.getState()
  }

  async installUpdate(): Promise<boolean> {
    if (this.state.phase !== 'downloaded') return false
    if (!(await this.beforeInstall())) return false

    autoUpdater.quitAndInstall(false, true)
    return true
  }

  private registerUpdaterEvents(): void {
    autoUpdater.on('checking-for-update', () => {
      this.setState({ phase: 'checking', message: '正在检查 GitHub Release...' })
    })
    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.setState({
        phase: 'available',
        availableVersion: info.version,
        progress: null,
        checkedAt: new Date().toISOString(),
        message: `发现新版本 ${info.version}`,
      })
    })
    autoUpdater.on('update-not-available', () => {
      this.setState({
        phase: 'not-available',
        availableVersion: null,
        progress: null,
        checkedAt: new Date().toISOString(),
        message: '当前已是最新版本',
      })
    })
    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
      const percent = Math.max(0, Math.min(100, progress.percent))
      this.setState({
        phase: 'downloading',
        progress: percent,
        message: `正在下载更新 ${Math.round(percent)}%`,
      })
    })
    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.setState({
        phase: 'downloaded',
        availableVersion: info.version,
        progress: 100,
        message: `版本 ${info.version} 已下载，重启后安装`,
      })
    })
    autoUpdater.on('error', (error: Error) => {
      this.setError(error, '自动更新失败')
    })
  }

  private getUnsupportedReason(): string | null {
    if (!app.isPackaged) return '开发环境不执行自动更新'
    if (process.platform === 'linux' && !process.env.APPIMAGE) {
      return '当前 Linux 安装格式不支持应用内更新，请从 GitHub Release 更新'
    }
    return null
  }

  private setError(error: unknown, prefix: string): void {
    const detail = error instanceof Error ? error.message : String(error)
    this.setState({
      phase: 'error',
      progress: null,
      checkedAt: new Date().toISOString(),
      message: `${prefix}: ${detail}`,
    })
  }

  private setState(patch: Partial<AppUpdateState>): void {
    this.state = { ...this.state, ...patch }
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send('updates:state-changed', this.getState())
      }
    }
  }
}
