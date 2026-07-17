import { simpleGit, SimpleGit } from 'simple-git'
import fs from 'fs'
import path from 'path'
import type { SyncConfig, SyncStatus, SyncConflict } from '../../src/types'

type SyncAction = 'manual' | 'auto'

interface SyncServiceOptions {
  beforeAutoSync?: () => Promise<boolean>
  onDataChanged?: (action: SyncAction | 'resolve') => void
}

export class SyncService {
  private dataDir: string
  private git: SimpleGit | null = null
  private syncInterval: NodeJS.Timeout | null = null
  private config: SyncConfig | null = null
  private conflicts: SyncConflict[] = []
  private operationQueue: Promise<void> = Promise.resolve()
  private operationActive = false
  private beforeAutoSync?: () => Promise<boolean>
  private onDataChanged?: (action: SyncAction | 'resolve') => void

  constructor(dataDir: string, options: SyncServiceOptions = {}) {
    this.dataDir = dataDir
    this.beforeAutoSync = options.beforeAutoSync
    this.onDataChanged = options.onDataChanged
  }

  getConfig(): SyncConfig | null {
    return this.config
  }

  async configure(config: SyncConfig): Promise<void> {
    this.config = config
    this.stopAutoSync()

    if (!config.enabled) {
      this.git = null
      this.conflicts = []
      return
    }

    if (config.provider === 'git') {
      await this.runExclusive(() => this.configureGit(config))
    }

    if (config.autoSync) {
      this.startAutoSync(config.syncInterval)
    }
  }

  private async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.operationQueue
    let release!: () => void
    this.operationQueue = new Promise<void>(resolve => {
      release = resolve
    })

    await previous
    this.operationActive = true

    try {
      return await operation()
    } finally {
      this.operationActive = false
      release()
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
    if (!config.repoUrl) {
      throw new Error('Git 仓库地址不能为空')
    }

    this.setupSshEnvironment()
    fs.mkdirSync(this.dataDir, { recursive: true })

    this.git = simpleGit(this.dataDir)
    if (!fs.existsSync(path.join(this.dataDir, '.git'))) {
      await this.git.init()
    }

    await this.ensureGitIdentity()
    await this.recoverLegacyRebase()
    await this.configureRemote(config.repoUrl)

    const branch = config.branch || 'main'
    if (this.isMergeInProgress()) {
      const currentBranch = (await this.git.raw(['branch', '--show-current'])).trim()
      if (currentBranch !== branch) {
        throw new Error(`分支 ${currentBranch} 仍有未完成的 merge，无法切换到 ${branch}`)
      }
    } else {
      await this.ensureLocalBranch(branch)
    }

    await this.refreshConflicts()
  }

  private async ensureGitIdentity(): Promise<void> {
    if (!this.git) return

    try {
      await this.git.raw(['config', '--get', 'user.name'])
    } catch {
      await this.git.raw(['config', 'user.name', 'ZZ-Note Sync'])
    }

    try {
      await this.git.raw(['config', '--get', 'user.email'])
    } catch {
      await this.git.raw(['config', 'user.email', 'zz-note@local'])
    }
  }

  private async configureRemote(repoUrl: string): Promise<void> {
    if (!this.git) return

    const remotes = await this.git.getRemotes(true)
    const origin = remotes.find(remote => remote.name === 'origin')
    if (origin) {
      if (this.isMergeInProgress() && origin.refs.fetch !== repoUrl) {
        throw new Error('当前仓库仍有未完成的 merge，不能更换远程仓库地址')
      }
      await this.git.remote(['set-url', 'origin', repoUrl])
    } else {
      await this.git.addRemote('origin', repoUrl)
    }
  }

  private async ensureLocalBranch(branch: string): Promise<void> {
    if (!this.git) return

    const currentBranch = (await this.git.raw(['branch', '--show-current'])).trim()
    if (currentBranch === branch) return

    const branches = await this.git.branchLocal()
    if (branches.all.includes(branch)) {
      await this.git.checkout(branch)
    } else {
      await this.git.checkoutLocalBranch(branch)
    }
  }

  async sync(): Promise<SyncStatus> {
    const validation = this.validateConfiguration()
    if (validation) return validation

    return this.runExclusive(() => this.gitSynchronize('manual'))
  }

  private validateConfiguration(): SyncStatus | null {
    if (!this.config?.enabled) {
      return { lastSync: null, status: 'error', message: '同步未配置' }
    }

    if (this.config.provider !== 'git') {
      return { lastSync: null, status: 'error', message: '暂不支持此同步方式' }
    }

    if (!this.git) {
      return { lastSync: null, status: 'error', message: 'Git 未初始化' }
    }

    return null
  }

  private async gitSynchronize(action: SyncAction): Promise<SyncStatus> {
    if (!this.git) {
      return { lastSync: null, status: 'error', message: 'Git 未初始化' }
    }

    const branch = this.config?.branch || 'main'

    try {
      if (action === 'auto' && this.beforeAutoSync && !(await this.beforeAutoSync())) {
        return {
          lastSync: null,
          status: 'idle',
          message: '自动同步已跳过：当前内容尚未保存',
        }
      }

      const interruptedStatus = await this.finishOrReportInterruptedOperation(action)
      if (interruptedStatus) return interruptedStatus

      await this.commitLocalChanges(`ZZ-Note ${action} sync: ${new Date().toISOString()}`)

      const remoteExists = await this.remoteBranchExists(branch)
      if (!remoteExists) {
        await this.pushRemote(branch)
        this.conflicts = []
        return this.successStatus(action)
      }

      await this.git.fetch('origin', branch, ['--prune'])
      const mergeResult = await this.mergeRemoteBranch(branch)
      if (mergeResult.conflictStatus) return mergeResult.conflictStatus

      if (mergeResult.dataChanged) {
        this.onDataChanged?.(action)
      }

      await this.pushRemote(branch)
      this.conflicts = []
      return this.successStatus(action)
    } catch (error) {
      const conflictStatus = await this.getConflictStatusIfPresent()
      if (conflictStatus) return conflictStatus

      return {
        lastSync: null,
        status: 'error',
        message: `${this.actionLabel(action)}失败: ${this.formatError(error)}`,
      }
    }
  }

  private async commitLocalChanges(message: string): Promise<void> {
    if (!this.git) return

    const status = await this.git.status()
    if (status.conflicted.length > 0) {
      throw new Error('仓库仍有未解决的冲突')
    }

    await this.git.add('.')
    const stagedStatus = await this.git.status()
    if (stagedStatus.files.length > 0) {
      await this.git.commit(message)
    }
  }

  private async remoteBranchExists(branch: string): Promise<boolean> {
    if (!this.git) return false
    const remoteRefs = await this.git.listRemote(['--heads', 'origin', branch])
    return Boolean(remoteRefs.trim())
  }

  private async mergeRemoteBranch(branch: string): Promise<{
    conflictStatus: SyncStatus | null
    dataChanged: boolean
  }> {
    if (!this.git) return { conflictStatus: null, dataChanged: false }

    const remoteRef = `origin/${branch}`
    const mergeArgs = [remoteRef, '--no-edit', '--allow-unrelated-histories']
    const headBeforeMerge = (await this.git.revparse('HEAD')).trim()

    try {
      await this.git.raw(['merge', ...mergeArgs])
      const headAfterMerge = (await this.git.revparse('HEAD')).trim()
      return {
        conflictStatus: null,
        dataChanged: headAfterMerge !== headBeforeMerge,
      }
    } catch (error) {
      const conflictStatus = await this.getConflictStatusIfPresent()
      if (conflictStatus) {
        return { conflictStatus, dataChanged: false }
      }
      throw error
    }
  }

  private async pushRemote(branch: string): Promise<void> {
    if (!this.git) return
    await this.git.raw(['push', '--set-upstream', 'origin', `HEAD:${branch}`])
  }

  private async finishOrReportInterruptedOperation(action: SyncAction): Promise<SyncStatus | null> {
    if (!this.git) return null

    if (this.isRebaseInProgress()) {
      await this.recoverLegacyRebase()
    }

    if (!this.isMergeInProgress()) return null

    const conflictStatus = await this.getConflictStatusIfPresent()
    if (conflictStatus) return conflictStatus

    await this.git.commit('ZZ-Note: complete interrupted merge')
    if (this.isMergeInProgress()) {
      throw new Error('Git merge 未能正常结束')
    }
    this.onDataChanged?.(action)

    return null
  }

  private async recoverLegacyRebase(): Promise<void> {
    if (!this.git || !this.isRebaseInProgress()) return

    await this.git.raw(['rebase', '--abort'])
    this.conflicts = []
  }

  private isRebaseInProgress(): boolean {
    const gitDir = path.join(this.dataDir, '.git')
    return fs.existsSync(path.join(gitDir, 'rebase-merge'))
      || fs.existsSync(path.join(gitDir, 'rebase-apply'))
  }

  private isMergeInProgress(): boolean {
    return fs.existsSync(path.join(this.dataDir, '.git', 'MERGE_HEAD'))
  }

  private async getConflictStatusIfPresent(): Promise<SyncStatus | null> {
    const conflicts = await this.refreshConflicts()
    if (conflicts.length === 0) return null

    return {
      lastSync: null,
      status: 'conflict',
      message: `有 ${conflicts.length} 个文件存在冲突，需要选择保留版本`,
      conflicts,
    }
  }

  private async refreshConflicts(): Promise<SyncConflict[]> {
    if (!this.git) {
      this.conflicts = []
      return this.conflicts
    }

    const status = await this.git.status()
    this.conflicts = await Promise.all(status.conflicted.map(async file => ({
      file,
      localContent: await this.readConflictStage(file, 2),
      remoteContent: await this.readConflictStage(file, 3),
      resolved: false,
    })))
    return this.conflicts
  }

  private async readConflictStage(file: string, stage: 2 | 3): Promise<string> {
    if (!this.git) return ''

    try {
      const content = await this.git.binaryCatFile(['-p', `:${stage}:${file}`]) as Buffer
      if (content.includes(0)) return ''
      return content.toString('utf-8')
    } catch {
      return ''
    }
  }

  async resolveConflicts(resolutions: Array<{ file: string; resolution: 'local' | 'remote' }>): Promise<SyncStatus> {
    const validation = this.validateConfiguration()
    if (validation) return validation

    return this.runExclusive(() => this.resolveGitConflicts(resolutions))
  }

  private async resolveGitConflicts(
    resolutions: Array<{ file: string; resolution: 'local' | 'remote' }>
  ): Promise<SyncStatus> {
    if (!this.git) {
      return { lastSync: null, status: 'error', message: 'Git 未初始化' }
    }

    const branch = this.config?.branch || 'main'

    try {
      if (this.isRebaseInProgress()) {
        await this.recoverLegacyRebase()
        return {
          lastSync: null,
          status: 'error',
          message: '已恢复旧版同步遗留的 rebase，请重新执行同步。',
        }
      }

      if (!this.isMergeInProgress()) {
        this.conflicts = []
        return {
          lastSync: null,
          status: 'error',
          message: '当前没有正在处理的 Git merge，请重新执行同步。',
        }
      }

      const currentConflicts = await this.refreshConflicts()
      const currentFiles = currentConflicts.map(conflict => conflict.file).sort()
      const resolutionFiles = [...new Set(resolutions.map(item => this.validateConflictPath(item.file)))].sort()

      if (currentFiles.join('\n') !== resolutionFiles.join('\n')) {
        return {
          lastSync: null,
          status: 'conflict',
          message: '冲突文件已经变化，请重新选择保留版本。',
          conflicts: currentConflicts,
        }
      }

      const resolutionMap = new Map(
        resolutions.map(item => [this.validateConflictPath(item.file), item.resolution])
      )
      for (const file of currentFiles) {
        const resolution = resolutionMap.get(file)
        if (!resolution) {
          throw new Error(`文件 ${file} 缺少冲突解决方案`)
        }

        await this.selectConflictStage(file, resolution === 'local' ? 2 : 3)
      }

      const remainingStatus = await this.getConflictStatusIfPresent()
      if (remainingStatus) return remainingStatus

      await this.git.commit('ZZ-Note: merge remote changes')
      if (this.isMergeInProgress()) {
        throw new Error('冲突文件已暂存，但 Git merge 仍未结束')
      }

      this.onDataChanged?.('resolve')
      await this.pushRemote(branch)
      this.conflicts = []

      return {
        lastSync: new Date().toISOString(),
        status: 'success',
        message: '冲突已解决并同步到远程',
      }
    } catch (error) {
      const conflictStatus = await this.getConflictStatusIfPresent()
      if (conflictStatus) return conflictStatus

      return {
        lastSync: null,
        status: 'error',
        message: `解决冲突失败: ${this.formatError(error)}`,
      }
    }
  }

  private validateConflictPath(file: string): string {
    const normalized = file.replace(/\\/g, '/')
    if (!normalized || path.posix.isAbsolute(normalized) || normalized.split('/').includes('..')) {
      throw new Error(`非法冲突文件路径: ${file}`)
    }
    return normalized
  }

  private async selectConflictStage(file: string, stage: 2 | 3): Promise<void> {
    if (!this.git) return

    const entries = await this.git.raw(['ls-files', '-u', '--', file])
    const stageExists = entries
      .split(/\r?\n/)
      .some(line => new RegExp(`\\s${stage}\\t`).test(line))

    if (stageExists) {
      await this.git.raw(['checkout', stage === 2 ? '--ours' : '--theirs', '--', file])
      await this.git.raw(['add', '--', file])
    } else {
      await this.git.raw(['rm', '--', file])
    }
  }

  async getStatus(): Promise<SyncStatus> {
    if (!this.config?.enabled) {
      return { lastSync: null, status: 'idle', message: '同步未配置' }
    }

    if (this.operationActive) {
      return { lastSync: null, status: 'syncing', message: '正在同步' }
    }

    if (this.config.provider === 'git' && this.git) {
      try {
        if (this.isRebaseInProgress()) {
          return {
            lastSync: null,
            status: 'error',
            message: '检测到旧版同步遗留的 rebase，下次同步时将自动恢复。',
          }
        }

        const conflictStatus = await this.getConflictStatusIfPresent()
        if (conflictStatus) return conflictStatus

        if (this.isMergeInProgress()) {
          return {
            lastSync: null,
            status: 'error',
            message: 'Git merge 尚未完成，请重新执行同步以继续。',
          }
        }

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
          message: `状态查询失败: ${this.formatError(error)}`,
        }
      }
    }

    return { lastSync: null, status: 'idle', message: '就绪' }
  }

  private successStatus(action: SyncAction): SyncStatus {
    const messages: Record<SyncAction, string> = {
      manual: '同步成功',
      auto: '自动同步成功',
    }

    return {
      lastSync: new Date().toISOString(),
      status: 'success',
      message: messages[action],
    }
  }

  private actionLabel(action: SyncAction): string {
    if (action === 'auto') return '自动同步'
    return '同步'
  }

  private formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }

  private startAutoSync(intervalMinutes: number): void {
    this.stopAutoSync()
    const safeIntervalMinutes = Math.max(1, intervalMinutes)
    this.syncInterval = setInterval(() => {
      if (this.operationActive) return

      void this.runExclusive(() => this.gitSynchronize('auto')).then(result => {
        if (result.status === 'error') {
          console.error(result.message)
        }
      }).catch(error => {
        console.error('自动同步失败:', error)
      })
    }, safeIntervalMinutes * 60 * 1000)
  }

  private stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
  }

  cleanup(): void {
    this.stopAutoSync()
  }
}
