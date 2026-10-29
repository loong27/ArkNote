import git from 'isomorphic-git'
import http from 'isomorphic-git/http/web'
import { Capacitor } from '@capacitor/core'
import { isHttpsGitUrl, isSshGitUrl, normalizeGitBranch } from '@shared/gitRemote'
import { ArkGit } from 'ark-git'
import {
  assertSyncAuth,
  loadSyncConfig,
  readSshPrivateKey,
  saveSyncConfig,
  type MobileSyncConfig,
} from './syncConfig'
import {
  VAULT_STAGING_DIR,
  clearStaging,
  createGitFs,
  getNativeDirectoryUri,
  promoteStagingToVault,
} from './vaultStore'
import { lockVault } from './session'

export interface SyncPullResult {
  success: boolean
  message: string
  lockedSession: boolean
}

function formatPullError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/authentication|401|403|permission denied|publickey|could not read/i.test(message)) {
    return 'Git 身份验证失败，请检查仓库权限、SSH 私钥或 HTTPS 访问令牌'
  }
  if (/couldn't find remote ref|remote branch|not found|404/i.test(message)) {
    return '未找到指定仓库或分支'
  }
  if (/network|timed out|timeout|connection|failed to fetch|ENOTFOUND/i.test(message)) {
    return '无法连接远程仓库，请检查网络后重试'
  }
  return message
}

async function pullHttps(config: MobileSyncConfig): Promise<void> {
  await clearStaging()
  const fs = createGitFs(VAULT_STAGING_DIR)
  const branch = normalizeGitBranch(config.branch || 'main')
  const token = (config.httpsToken || '').trim()

  await git.clone({
    fs,
    http,
    dir: '.',
    url: config.repoUrl,
    ref: branch,
    singleBranch: true,
    depth: 1,
    onAuth: token
      ? () => ({ username: 'git', password: token })
      : undefined,
  })
}

async function pullSsh(config: MobileSyncConfig): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('SSH Git 拉取仅支持 Android / iOS 原生壳，浏览器请改用 HTTPS + Token')
  }

  const key = await readSshPrivateKey()
  if (!key?.privateKey) {
    throw new Error('SSH 仓库需要先导入私钥')
  }

  await clearStaging()
  const targetPath = await getNativeDirectoryUri(VAULT_STAGING_DIR)

  const result = await ArkGit.pull({
    repoUrl: config.repoUrl,
    branch: normalizeGitBranch(config.branch || 'main'),
    privateKey: key.privateKey,
    passphrase: key.passphrase || undefined,
    targetPath,
  })

  if (!result.success) {
    throw new Error(result.message || 'SSH 同步失败')
  }
}

/** One-way cloud → local pull. Locks an open session after success. */
export async function runSyncPull(): Promise<SyncPullResult> {
  const config = await loadSyncConfig()
  try {
    assertSyncAuth(config)

    if (isSshGitUrl(config.repoUrl)) {
      await pullSsh(config)
    } else if (isHttpsGitUrl(config.repoUrl)) {
      await pullHttps(config)
    } else {
      throw new Error('请输入有效的 Git HTTPS 或 SSH 仓库地址')
    }

    await promoteStagingToVault()
    await clearStaging()

    const lockedSession = true
    lockVault()

    await saveSyncConfig({
      enabled: true,
      lastSyncAt: new Date().toISOString(),
      lastError: null,
    })

    return {
      success: true,
      message: '同步完成，请使用仓库密码重新解锁',
      lockedSession,
    }
  } catch (error) {
    const message = formatPullError(error)
    await saveSyncConfig({ lastError: message }).catch(() => {})
    return { success: false, message, lockedSession: false }
  }
}

export async function testSyncConnection(): Promise<SyncPullResult> {
  const config = await loadSyncConfig()
  try {
    assertSyncAuth(config)

    if (isSshGitUrl(config.repoUrl)) {
      if (!Capacitor.isNativePlatform()) {
        throw new Error('SSH 测试仅支持 Android / iOS 原生壳')
      }
      const key = await readSshPrivateKey()
      if (!key?.privateKey) throw new Error('SSH 仓库需要先导入私钥')

      await clearStaging()
      const targetPath = await getNativeDirectoryUri(VAULT_STAGING_DIR)
      const result = await ArkGit.testAuth({
        repoUrl: config.repoUrl,
        branch: normalizeGitBranch(config.branch || 'main'),
        privateKey: key.privateKey,
        passphrase: key.passphrase || undefined,
        targetPath,
      })
      await clearStaging()
      if (!result.success) throw new Error(result.message || 'SSH 测试失败')
      return { success: true, message: result.message || '连接成功', lockedSession: false }
    }

    // HTTPS: shallow clone into staging then discard
    await pullHttps(config)
    await clearStaging()
    return { success: true, message: '连接成功', lockedSession: false }
  } catch (error) {
    await clearStaging().catch(() => {})
    return { success: false, message: formatPullError(error), lockedSession: false }
  }
}
