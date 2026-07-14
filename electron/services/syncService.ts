import { simpleGit, SimpleGit } from 'simple-git'
import fs from 'fs'
import path from 'path'
import type { SyncConfig, SyncStatus, SyncConflict } from '../../src/types'

export class SyncService {
  private dataDir: string
  private git: SimpleGit | null = null
  private syncInterval: NodeJS.Timeout | null = null
  private config: SyncConfig | null = null
  private conflicts: SyncConflict[] = []

  constructor(dataDir: string) {
    this.dataDir = dataDir
  }

  getConfig(): SyncConfig | null {
    return this.config
  }

  /**
   * Configure sync
   */
  async configure(config: SyncConfig): Promise<void> {
    this.config = config

    if (!config.enabled) {
      this.stopAutoSync()
      return
    }

    if (config.provider === 'git') {
      await this.configureGit(config)
    }

    if (config.autoSync) {
      this.startAutoSync(config.syncInterval)
    }
  }

  private setupSshEnvironment(): void {
    if (!process.env.GIT_SSH_COMMAND) {
      process.env.GIT_SSH_COMMAND = 'ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes'
    }

    if (!process.env.SSH_AUTH_SOCK) {
      const uid = process.getuid?.()
      if (uid !== undefined) {
        const candidates = [
          `/run/user/${uid}/keyring/ssh`,
          `/run/user/${uid}/ssh-agent.socket`,
        ]
        for (const sock of candidates) {
          if (fs.existsSync(sock)) {
            process.env.SSH_AUTH_SOCK = sock
            break
          }
        }
      }
    }
  }

  private async configureGit(config: SyncConfig): Promise<void> {
    if (!config.repoUrl) return

    this.setupSshEnvironment()

    // Initialize git repo if not already
    if (!fs.existsSync(path.join(this.dataDir, '.git'))) {
      this.git = simpleGit(this.dataDir)
      await this.git.init()
      fs.writeFileSync(path.join(this.dataDir, '.gitignore'), '')
      await this.git.add('.')
      await this.git.commit('Initial commit')
    } else {
      this.git = simpleGit(this.dataDir)
    }

    // Set remote
    try {
      await this.git.removeRemote('origin')
    } catch {
      // Remote might not exist yet
    }
    await this.git.addRemote('origin', config.repoUrl)

    // Set branch
    const branch = config.branch || 'main'
    try {
      await this.git.checkout(branch)
    } catch {
      await this.git.checkoutLocalBranch(branch)
    }
  }

  /**
   * Push changes to remote
   */
  async push(): Promise<SyncStatus> {
    if (!this.config?.enabled) {
      return { lastSync: null, status: 'error', message: '同步未配置' }
    }

    if (this.config.provider === 'git') {
      return this.gitPush()
    }

    return { lastSync: null, status: 'error', message: '暂不支持此同步方式' }
  }

  private async gitPush(): Promise<SyncStatus> {
    if (!this.git) {
      return { lastSync: null, status: 'error', message: 'Git 未初始化' }
    }

    const branch = this.config?.branch || 'main'

    try {
      await this.git.add('.')

      const status = await this.git.status()
      if (status.files.length > 0) {
        const now = new Date().toISOString()
        await this.git.commit(`ZZ-Note sync: ${now}`)
      }

      await this.git.push('origin', branch, ['--set-upstream'])

      return {
        lastSync: new Date().toISOString(),
        status: 'success',
        message: '推送成功',
      }
    } catch (error) {
      return {
        lastSync: null,
        status: 'error',
        message: `推送失败: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  /**
   * Pull changes from remote
   */
  async pull(): Promise<SyncStatus> {
    if (!this.config?.enabled) {
      return { lastSync: null, status: 'error', message: '同步未配置' }
    }

    if (this.config.provider === 'git') {
      return this.gitPull()
    }

    return { lastSync: null, status: 'error', message: '暂不支持此同步方式' }
  }

  private async gitPull(): Promise<SyncStatus> {
    if (!this.git) {
      return { lastSync: null, status: 'error', message: 'Git 未初始化' }
    }

    const branch = this.config?.branch || 'main'

    try {
      // Check if remote branch exists before pulling
      const remoteRefs = await this.git.listRemote(['--heads', 'origin', branch])
      if (!remoteRefs || !remoteRefs.trim()) {
        return {
          lastSync: null,
          status: 'error',
          message: `远程仓库中不存在分支 "${branch}"。如果这是新仓库，请先点击「推送到远程」上传本地数据。`,
        }
      }

      await this.git.add('.')
      const status = await this.git.status()
      if (status.files.length > 0) {
        await this.git.commit('ZZ-Note: auto-commit before pull')
      }

      try {
        await this.git.pull('origin', branch, { '--rebase': 'true' })
      } catch (pullError) {
        // Check for conflicts
        const mergeStatus = await this.git.status()
        if (mergeStatus.conflicted.length > 0) {
          this.conflicts = mergeStatus.conflicted.map(file => ({
            file,
            localContent: this.readConflictContent(file, 'ours'),
            remoteContent: this.readConflictContent(file, 'theirs'),
            resolved: false,
          }))

          return {
            lastSync: null,
            status: 'conflict',
            message: `有 ${mergeStatus.conflicted.length} 个文件存在冲突，需要手动解决`,
            conflicts: this.conflicts,
          }
        }
        throw pullError
      }

      return {
        lastSync: new Date().toISOString(),
        status: 'success',
        message: '拉取成功',
      }
    } catch (error) {
      return {
        lastSync: null,
        status: 'error',
        message: `拉取失败: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  private readConflictContent(file: string, side: 'ours' | 'theirs'): string {
    try {
      const filePath = path.join(this.dataDir, file)
      const content = fs.readFileSync(filePath, 'utf-8')

      // Parse git conflict markers
      if (side === 'ours') {
        const match = content.match(/<<<<<<< .*\n([\s\S]*?)=======/)
        return match ? match[1] : content
      } else {
        const match = content.match(/=======\n([\s\S]*?)>>>>>>> /)
        return match ? match[1] : content
      }
    } catch {
      return ''
    }
  }

  /**
   * Resolve conflicts
   */
  async resolveConflicts(resolutions: Array<{ file: string; resolution: 'local' | 'remote' }>): Promise<SyncStatus> {
    if (!this.git) {
      return { lastSync: null, status: 'error', message: 'Git 未初始化' }
    }

    try {
      for (const { file, resolution } of resolutions) {
        const filePath = path.join(this.dataDir, file)

        if (resolution === 'local') {
          // Use --ours for local version
          await this.git.checkout(['--ours', filePath])
        } else {
          // Use --theirs for remote version
          await this.git.checkout(['--theirs', filePath])
        }

        await this.git.add(filePath)
      }

      // Continue rebase
      try {
        await this.git.rebase(['--continue'])
      } catch {
        // If rebase --continue fails, try commit
        await this.git.commit('ZZ-Note: resolved conflicts')
      }

      this.conflicts = []

      return {
        lastSync: new Date().toISOString(),
        status: 'success',
        message: '冲突已解决',
      }
    } catch (error) {
      return {
        lastSync: null,
        status: 'error',
        message: `解决冲突失败: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  /**
   * Get current sync status
   */
  async getStatus(): Promise<SyncStatus> {
    if (!this.config?.enabled) {
      return { lastSync: null, status: 'idle', message: '同步未配置' }
    }

    if (this.conflicts.length > 0) {
      return {
        lastSync: null,
        status: 'conflict',
        message: `有 ${this.conflicts.length} 个文件存在冲突`,
        conflicts: this.conflicts,
      }
    }

    if (this.config.provider === 'git' && this.git) {
      try {
        const status = await this.git.status()
        const hasChanges = status.files.length > 0

        return {
          lastSync: null,
          status: 'idle',
          message: hasChanges ? `有 ${status.files.length} 个文件待同步` : '已同步',
        }
      } catch (error) {
        return {
          lastSync: null,
          status: 'error',
          message: `状态查询失败: ${error instanceof Error ? error.message : String(error)}`,
        }
      }
    }

    return { lastSync: null, status: 'idle', message: '就绪' }
  }

  /**
   * Start auto sync interval
   */
  private startAutoSync(intervalMinutes: number): void {
    this.stopAutoSync()
    this.syncInterval = setInterval(
      async () => {
        await this.push()
      },
      intervalMinutes * 60 * 1000
    )
  }

  /**
   * Stop auto sync
   */
  private stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }

  /**
   * Cleanup on app close
   */
  cleanup(): void {
    this.stopAutoSync()
  }
}
