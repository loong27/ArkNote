import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Preferences } from '@capacitor/preferences'
import {
  isHttpsGitUrl,
  isSshGitUrl,
  isValidGitRemoteUrl,
  normalizeGitBranch,
  stripEmbeddedCredentials,
} from '@shared/gitRemote'

const PREF_KEY = 'arknote.reader.sync.v1'
const SSH_KEY_PATH = 'secrets/ssh_key'
const SSH_PASS_PATH = 'secrets/ssh_passphrase'
const DIR = Directory.Data

export interface MobileSyncConfig {
  enabled: boolean
  repoUrl: string
  branch: string
  /** Present in memory after load; persisted separately. */
  httpsToken: string
  hasSshKey: boolean
  sshPassphrase: string
  lastSyncAt: string | null
  lastError: string | null
}

const defaults: MobileSyncConfig = {
  enabled: false,
  repoUrl: '',
  branch: 'main',
  httpsToken: '',
  hasSshKey: false,
  sshPassphrase: '',
  lastSyncAt: null,
  lastError: null,
}

async function ensureSecretsDir(): Promise<void> {
  try {
    await Filesystem.mkdir({ path: 'secrets', directory: DIR, recursive: true })
  } catch {
    // exists
  }
}

export async function loadSyncConfig(): Promise<MobileSyncConfig> {
  const { value } = await Preferences.get({ key: PREF_KEY })
  let parsed: Partial<MobileSyncConfig> = {}
  if (value) {
    try {
      parsed = JSON.parse(value) as Partial<MobileSyncConfig>
    } catch {
      parsed = {}
    }
  }

  let httpsToken = ''
  const tokenPref = await Preferences.get({ key: `${PREF_KEY}.token` })
  httpsToken = tokenPref.value || ''

  let hasSshKey = false
  try {
    await Filesystem.stat({ path: SSH_KEY_PATH, directory: DIR })
    hasSshKey = true
  } catch {
    hasSshKey = false
  }

  let sshPassphrase = ''
  try {
    const pass = await Filesystem.readFile({
      path: SSH_PASS_PATH,
      directory: DIR,
      encoding: Encoding.UTF8,
    })
    sshPassphrase = String(pass.data || '')
  } catch {
    sshPassphrase = ''
  }

  return {
    ...defaults,
    ...parsed,
    httpsToken,
    hasSshKey,
    sshPassphrase,
    repoUrl: stripEmbeddedCredentials(String(parsed.repoUrl || '')),
    branch: String(parsed.branch || 'main'),
  }
}

export async function saveSyncConfig(partial: Partial<MobileSyncConfig>): Promise<MobileSyncConfig> {
  const current = await loadSyncConfig()
  const next: MobileSyncConfig = {
    ...current,
    ...partial,
    repoUrl: stripEmbeddedCredentials((partial.repoUrl ?? current.repoUrl).trim()),
  }

  if (next.repoUrl && !isValidGitRemoteUrl(next.repoUrl)) {
    throw new Error('请输入有效的 Git HTTPS 或 SSH 仓库地址')
  }
  next.branch = normalizeGitBranch(next.branch || 'main')

  const publicPart = {
    enabled: next.enabled,
    repoUrl: next.repoUrl,
    branch: next.branch,
    lastSyncAt: next.lastSyncAt,
    lastError: next.lastError,
  }
  await Preferences.set({ key: PREF_KEY, value: JSON.stringify(publicPart) })

  if (partial.httpsToken !== undefined) {
    await Preferences.set({ key: `${PREF_KEY}.token`, value: next.httpsToken })
  }

  return loadSyncConfig()
}

export async function saveSshPrivateKey(pem: string, passphrase = ''): Promise<MobileSyncConfig> {
  const trimmed = pem.trim()
  if (!trimmed.includes('PRIVATE KEY')) {
    throw new Error('请粘贴有效的 OpenSSH / PEM 私钥')
  }
  await ensureSecretsDir()
  await Filesystem.writeFile({
    path: SSH_KEY_PATH,
    directory: DIR,
    data: trimmed,
    encoding: Encoding.UTF8,
  })
  if (passphrase) {
    await Filesystem.writeFile({
      path: SSH_PASS_PATH,
      directory: DIR,
      data: passphrase,
      encoding: Encoding.UTF8,
    })
  } else {
    try {
      await Filesystem.deleteFile({ path: SSH_PASS_PATH, directory: DIR })
    } catch {
      // ignore
    }
  }
  return loadSyncConfig()
}

export async function clearSshPrivateKey(): Promise<MobileSyncConfig> {
  try {
    await Filesystem.deleteFile({ path: SSH_KEY_PATH, directory: DIR })
  } catch {
    // ignore
  }
  try {
    await Filesystem.deleteFile({ path: SSH_PASS_PATH, directory: DIR })
  } catch {
    // ignore
  }
  return loadSyncConfig()
}

export async function readSshPrivateKey(): Promise<{ privateKey: string; passphrase: string } | null> {
  try {
    const key = await Filesystem.readFile({
      path: SSH_KEY_PATH,
      directory: DIR,
      encoding: Encoding.UTF8,
    })
    let passphrase = ''
    try {
      const pass = await Filesystem.readFile({
        path: SSH_PASS_PATH,
        directory: DIR,
        encoding: Encoding.UTF8,
      })
      passphrase = String(pass.data || '')
    } catch {
      passphrase = ''
    }
    return { privateKey: String(key.data || ''), passphrase }
  } catch {
    return null
  }
}

export function assertSyncAuth(config: MobileSyncConfig): void {
  if (!config.repoUrl) throw new Error('请先配置 Git 仓库地址')
  if (!isValidGitRemoteUrl(config.repoUrl)) {
    throw new Error('请输入有效的 Git HTTPS 或 SSH 仓库地址')
  }
  normalizeGitBranch(config.branch || 'main')

  if (isSshGitUrl(config.repoUrl)) {
    if (!config.hasSshKey) throw new Error('SSH 仓库需要先导入私钥')
    return
  }
  if (isHttpsGitUrl(config.repoUrl)) {
    // Public repos may omit token; private repos will fail at pull time.
    return
  }
  throw new Error('请输入有效的 Git HTTPS 或 SSH 仓库地址')
}

export { isHttpsGitUrl, isSshGitUrl }
