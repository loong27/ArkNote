import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { simpleGit } from 'simple-git'
import {
  embedHttpsCredentials,
  isValidGitRemoteUrl,
  normalizeGitBranch,
  stripEmbeddedCredentials,
} from './gitCredentials'

export interface VaultRestoreRequest {
  repoUrl: string
  branch: string
  httpsToken?: string
}

export interface VaultRestoreResult {
  success: boolean
  message: string
}

interface VaultRestoreServiceOptions {
  cloneRepository?: (repoUrl: string, targetDir: string, branch: string) => Promise<void>
  getHttpsToken?: () => string
}

export class VaultRestoreService {
  private readonly cloneRepository: (repoUrl: string, targetDir: string, branch: string) => Promise<void>
  private readonly getHttpsToken?: () => string
  private restoreInProgress = false

  constructor(
    private readonly dataDir: string,
    options: VaultRestoreServiceOptions = {},
  ) {
    this.cloneRepository = options.cloneRepository ?? this.cloneGitRepository.bind(this)
    this.getHttpsToken = options.getHttpsToken
  }

  async restore(request: VaultRestoreRequest): Promise<VaultRestoreResult> {
    if (this.restoreInProgress) {
      return { success: false, message: '恢复任务正在进行，请稍候' }
    }

    let stagingDir = ''
    let restored = false
    this.restoreInProgress = true

    try {
      const repoUrl = this.validateRepoUrl(request.repoUrl)
      const branch = this.validateBranch(request.branch)
      this.assertTargetIsEmpty()

      const parentDir = path.dirname(this.dataDir)
      fs.mkdirSync(parentDir, { recursive: true })
      stagingDir = path.join(
        parentDir,
        `.${path.basename(this.dataDir)}.restore-${process.pid}-${crypto.randomUUID()}`,
      )

      const token = (request.httpsToken || this.getHttpsToken?.() || '').trim()
      const cloneUrl = token ? embedHttpsCredentials(repoUrl, token) : repoUrl

      await this.cloneRepository(cloneUrl, stagingDir, branch)
      this.validateRestoredVault(stagingDir)
      this.assertTargetIsEmpty()

      if (fs.existsSync(this.dataDir)) {
        fs.rmdirSync(this.dataDir)
      }
      fs.renameSync(stagingDir, this.dataDir)
      restored = true

      return {
        success: true,
        message: '加密数据已恢复，请使用原仓库密码解锁',
      }
    } catch (error) {
      return {
        success: false,
        message: this.formatError(error),
      }
    } finally {
      if (!restored && stagingDir && fs.existsSync(stagingDir)) {
        fs.rmSync(stagingDir, { recursive: true, force: true })
      }
      this.restoreInProgress = false
    }
  }

  private validateRepoUrl(value: string): string {
    const repoUrl = stripEmbeddedCredentials(value.trim())
    if (!isValidGitRemoteUrl(repoUrl)) {
      throw new Error('请输入有效的 Git HTTPS 或 SSH 仓库地址')
    }
    return repoUrl
  }

  private validateBranch(value: string): string {
    return normalizeGitBranch(value)
  }

  private assertTargetIsEmpty(): void {
    if (!fs.existsSync(this.dataDir)) return
    if (!fs.statSync(this.dataDir).isDirectory()) {
      throw new Error('本地数据路径不是目录')
    }
    if (fs.readdirSync(this.dataDir).length > 0) {
      throw new Error('本地数据目录已有内容，已取消恢复以避免覆盖数据')
    }
  }

  private validateRestoredVault(dir: string): void {
    const gitDir = path.join(dir, '.git')
    const saltPath = path.join(dir, 'salt.bin')
    const verifyPath = path.join(dir, 'verify.enc')
    const metadataPath = path.join(dir, 'metadata.json.enc')

    if (!fs.existsSync(gitDir) || !fs.statSync(gitDir).isDirectory()) {
      throw new Error('远程仓库不是有效的 Git 仓库')
    }
    if (!fs.existsSync(saltPath) || fs.statSync(saltPath).size !== 32) {
      throw new Error('远程仓库缺少有效的 salt.bin')
    }
    if (!fs.existsSync(verifyPath) || fs.statSync(verifyPath).size < 29) {
      throw new Error('远程仓库缺少有效的 verify.enc')
    }
    if (!fs.existsSync(metadataPath) || fs.statSync(metadataPath).size < 29) {
      throw new Error('远程仓库缺少有效的 metadata.json.enc')
    }

    this.rejectSymbolicLinks(dir)
  }

  private rejectSymbolicLinks(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) {
        throw new Error('远程仓库包含不受支持的符号链接')
      }
      if (entry.isDirectory()) {
        this.rejectSymbolicLinks(path.join(dir, entry.name))
      }
    }
  }

  private async cloneGitRepository(repoUrl: string, targetDir: string, branch: string): Promise<void> {
    const env = { ...process.env }
    env.GIT_TERMINAL_PROMPT = '0'
    env.GIT_SSH_COMMAND = env.GIT_SSH_COMMAND
      || 'ssh -o StrictHostKeyChecking=accept-new -o BatchMode=yes'

    await simpleGit({ binary: 'git', maxConcurrentProcesses: 1 })
      .env(env)
      .clone(repoUrl, targetDir, ['--branch', branch, '--single-branch'])
  }

  private formatError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error)
    if (/authentication|permission denied|publickey|could not read|401|403/i.test(message)) {
      return 'Git 身份验证失败，请检查仓库权限、SSH 密钥或 HTTPS 访问令牌'
    }
    if (/couldn't find remote ref|remote branch|not found/i.test(message)) {
      return '未找到指定仓库或分支'
    }
    if (/resolve host|network|timed out|timeout|connection/i.test(message)) {
      return '无法连接远程仓库，请检查网络后重试'
    }
    return message
  }
}
