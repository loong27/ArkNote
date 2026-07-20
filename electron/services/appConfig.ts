import fs from 'fs'
import path from 'path'
import os from 'os'
import { normalizeLanguage, type AppLanguage } from '../../shared/i18n'

/**
 * AppConfig manages non-encrypted application settings.
 * Stored at ~/.ark-note-config.json (fixed location, always readable).
 *
 * This is separate from the encrypted metadata because:
 * 1. We need to know the data directory BEFORE decrypting anything
 * 2. These settings are not sensitive
 */

export type CloseAction = 'ask' | 'minimize' | 'quit'

export type ThemeMode = 'dark' | 'light'

export interface SecurityConfig {
  autoLockMinutes: number
  lockOnMinimize: boolean
}

export interface StoredAuthThrottle {
  failedAttempts: number
  nextAllowedAt: number
  lastFailureAt: number
}

export interface AppConfigData {
  /** Path to the encrypted data vault directory */
  dataDir: string
  /** Window size/position memory */
  windowBounds?: { width: number; height: number; x?: number; y?: number }
  /** What to do when user clicks close button: ask, minimize to tray, or quit */
  closeAction: CloseAction
  /** Theme: dark or light */
  theme: ThemeMode
  /** User interface language */
  language: AppLanguage
  /** Sidebar panel width percentage */
  sidebarWidth: number
  /** Minutes of inactivity before locking; 0 disables idle locking */
  autoLockMinutes: number
  /** Clear the vault key whenever the app is minimized or hidden */
  lockOnMinimize: boolean
  /** Per-vault password retry state. This is deterrence, not offline-attack protection. */
  authThrottle: Record<string, StoredAuthThrottle>
}

const CONFIG_PATH = path.join(os.homedir(), '.ark-note-config.json')
const DEFAULT_DATA_DIR = path.join(os.homedir(), '.ark-note')
const LEGACY_BRAND_SLUG = globalThis.atob('enotbm90ZQ==')
const LEGACY_CONFIG_PATH = path.join(os.homedir(), `.${LEGACY_BRAND_SLUG}-config.json`)
const LEGACY_DEFAULT_DATA_DIR = path.join(os.homedir(), `.${LEGACY_BRAND_SLUG}`)

export class AppConfig {
  private config: AppConfigData

  constructor() {
    this.config = this.load()
    if (!fs.existsSync(CONFIG_PATH)) {
      this.save()
    }
  }

  /**
   * Load config from disk, or create default
   */
  private load(): AppConfigData {
    const existingDefaultDataDir = !fs.existsSync(DEFAULT_DATA_DIR) && fs.existsSync(LEGACY_DEFAULT_DATA_DIR)
      ? LEGACY_DEFAULT_DATA_DIR
      : DEFAULT_DATA_DIR

    try {
      const configPath = fs.existsSync(CONFIG_PATH)
        ? CONFIG_PATH
        : fs.existsSync(LEGACY_CONFIG_PATH)
          ? LEGACY_CONFIG_PATH
          : null
      const fallbackDataDir = configPath === LEGACY_CONFIG_PATH
        ? LEGACY_DEFAULT_DATA_DIR
        : existingDefaultDataDir

      if (configPath) {
        const content = fs.readFileSync(configPath, 'utf-8')
        const parsed = JSON.parse(content) as Partial<AppConfigData>
        return {
          dataDir: parsed.dataDir || fallbackDataDir,
          windowBounds: parsed.windowBounds,
          closeAction: parsed.closeAction || 'ask',
          theme: parsed.theme || 'dark',
          language: normalizeLanguage(parsed.language),
          sidebarWidth: this.clampSidebarWidth(parsed.sidebarWidth),
          autoLockMinutes: this.clampAutoLockMinutes(parsed.autoLockMinutes),
          lockOnMinimize: parsed.lockOnMinimize !== false,
          authThrottle: this.sanitizeAuthThrottle(parsed.authThrottle),
        }
      }
    } catch (error) {
      console.error('Failed to load app config:', error)
    }

    return {
      dataDir: existingDefaultDataDir,
      closeAction: 'ask',
      theme: 'dark',
      language: 'zh-CN',
      sidebarWidth: 15,
      autoLockMinutes: 15,
      lockOnMinimize: true,
      authThrottle: {},
    }
  }

  private clampSidebarWidth(width: unknown): number {
    return typeof width === 'number' && Number.isFinite(width) ? Math.min(40, Math.max(10, width)) : 15
  }

  private clampAutoLockMinutes(minutes: unknown): number {
    if (typeof minutes !== 'number' || !Number.isFinite(minutes)) return 15
    if (minutes <= 0) return 0
    return Math.min(240, Math.max(1, Math.round(minutes)))
  }

  private sanitizeAuthThrottle(value: unknown): Record<string, StoredAuthThrottle> {
    if (!value || typeof value !== 'object') return {}

    const result: Record<string, StoredAuthThrottle> = {}
    for (const [key, entry] of Object.entries(value)) {
      if (!/^[a-f0-9]{64}$/.test(key) || !entry || typeof entry !== 'object') continue
      const candidate = entry as Partial<StoredAuthThrottle>
      if (
        typeof candidate.failedAttempts !== 'number'
        || typeof candidate.nextAllowedAt !== 'number'
        || typeof candidate.lastFailureAt !== 'number'
      ) continue

      result[key] = {
        failedAttempts: Math.max(0, Math.floor(candidate.failedAttempts)),
        nextAllowedAt: Math.max(0, candidate.nextAllowedAt),
        lastFailureAt: Math.max(0, candidate.lastFailureAt),
      }
    }
    return result
  }

  /**
   * Save config to disk
   */
  private save(): void {
    try {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2), 'utf-8')
    } catch (error) {
      console.error('Failed to save app config:', error)
    }
  }

  /**
   * Get the data directory path
   */
  getDataDir(): string {
    return this.config.dataDir
  }

  /**
   * Set the data directory path.
   * Does NOT move existing data - caller must handle migration.
   */
  setDataDir(newDir: string): void {
    this.config.dataDir = newDir
    this.save()
  }

  /**
   * Get window bounds
   */
  getWindowBounds(): AppConfigData['windowBounds'] {
    return this.config.windowBounds
  }

  /**
   * Save window bounds
   */
  setWindowBounds(bounds: AppConfigData['windowBounds']): void {
    this.config.windowBounds = bounds
    this.save()
  }

  /**
   * Get close action preference
   */
  getCloseAction(): CloseAction {
    return this.config.closeAction
  }

  /**
   * Set close action preference
   */
  setCloseAction(action: CloseAction): void {
    this.config.closeAction = action
    this.save()
  }

  /**
   * Get theme
   */
  getTheme(): ThemeMode {
    return this.config.theme
  }

  /**
   * Set theme
   */
  setTheme(theme: ThemeMode): void {
    this.config.theme = theme
    this.save()
  }

  getLanguage(): AppLanguage {
    return this.config.language
  }

  setLanguage(language: AppLanguage): void {
    this.config.language = normalizeLanguage(language)
    this.save()
  }

  getSidebarWidth(): number {
    return this.config.sidebarWidth
  }

  setSidebarWidth(width: number): void {
    this.config.sidebarWidth = this.clampSidebarWidth(width)
    this.save()
  }

  getSecurityConfig(): SecurityConfig {
    return {
      autoLockMinutes: this.config.autoLockMinutes,
      lockOnMinimize: this.config.lockOnMinimize,
    }
  }

  setSecurityConfig(config: SecurityConfig): SecurityConfig {
    this.config.autoLockMinutes = this.clampAutoLockMinutes(config.autoLockMinutes)
    this.config.lockOnMinimize = Boolean(config.lockOnMinimize)
    this.save()
    return this.getSecurityConfig()
  }

  getAuthThrottle(key: string): StoredAuthThrottle | null {
    return this.config.authThrottle[key] ? { ...this.config.authThrottle[key] } : null
  }

  setAuthThrottle(key: string, state: StoredAuthThrottle): void {
    this.config.authThrottle[key] = { ...state }
    this.save()
  }

  clearAuthThrottle(key: string): void {
    if (!this.config.authThrottle[key]) return
    delete this.config.authThrottle[key]
    this.save()
  }

  /**
   * Get the full config
   */
  getAll(): AppConfigData {
    return { ...this.config }
  }

  /**
   * Get the config file path (for display to user)
   */
  static getConfigPath(): string {
    return CONFIG_PATH
  }

  /**
   * Get the default data directory
   */
  static getDefaultDataDir(): string {
    return DEFAULT_DATA_DIR
  }

  inspectDataDir(dir: string): { mode: 'current' | 'switch' | 'migrate'; message: string } {
    if (path.resolve(dir) === path.resolve(this.config.dataDir)) {
      return { mode: 'current', message: '当前正在使用此数据目录，不会执行迁移或切换。' }
    }

    if (fs.existsSync(path.join(dir, 'salt.bin'))) {
      return { mode: 'switch', message: '检测到已有 arkNote 数据仓库：应用后只会切换到此目录，不会迁移或覆盖当前数据。' }
    }

    return { mode: 'migrate', message: '未检测到已有 arkNote 数据仓库：应用后会把当前数据迁移到此目录。' }
  }

  /**
   * Move/copy data from old directory to new directory.
   * Returns true on success, false on failure.
   */
  async migrateData(oldDir: string, newDir: string): Promise<{ success: boolean; message: string }> {
    try {
      // Validate new directory
      if (!fs.existsSync(newDir)) {
        fs.mkdirSync(newDir, { recursive: true })
      }

      // Check if new directory is empty or is a valid vault
      const entries = fs.readdirSync(newDir)
      const hasExistingVault = entries.includes('salt.bin')

      if (hasExistingVault) {
        // New directory already has a vault - just switch to it
        this.setDataDir(newDir)
        return {
          success: true,
          message: '已切换到已有的数据仓库',
        }
      }

      // Copy all files from old to new
      if (fs.existsSync(oldDir)) {
        this.copyDirRecursive(oldDir, newDir)
      }

      this.setDataDir(newDir)
      return {
        success: true,
        message: '数据已迁移到新目录',
      }
    } catch (error) {
      return {
        success: false,
        message: `迁移失败: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  /**
   * Recursively copy directory contents
   */
  private copyDirRecursive(src: string, dest: string): void {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true })
    }

    const entries = fs.readdirSync(src, { withFileTypes: true })
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)

      if (entry.isDirectory()) {
        this.copyDirRecursive(srcPath, destPath)
      } else {
        fs.copyFileSync(srcPath, destPath)
      }
    }
  }
}
