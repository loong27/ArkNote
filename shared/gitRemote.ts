/**
 * Git remote URL helpers shared by desktop sync and mobile pull-only sync.
 * Tokens / SSH keys stay in local app config, never in the vault Git tree.
 */

export function isHttpsGitUrl(repoUrl: string): boolean {
  return /^https:\/\//i.test(repoUrl.trim())
}

export function isSshGitUrl(repoUrl: string): boolean {
  return /^git@|^ssh:\/\//i.test(repoUrl.trim())
}

export function stripEmbeddedCredentials(repoUrl: string): string {
  try {
    const url = new URL(repoUrl.trim())
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return repoUrl.trim()
    url.username = ''
    url.password = ''
    return url.toString().replace(/\/$/, '') === repoUrl.trim().replace(/\/$/, '')
      ? repoUrl.trim()
      : url.toString()
  } catch {
    return repoUrl.trim()
  }
}

export function embedHttpsCredentials(repoUrl: string, token: string, username = 'git'): string {
  const trimmed = repoUrl.trim()
  const secret = token.trim()
  if (!secret || !isHttpsGitUrl(trimmed)) return stripEmbeddedCredentials(trimmed)

  try {
    const url = new URL(trimmed)
    url.username = encodeURIComponent(username)
    url.password = encodeURIComponent(secret)
    return url.toString()
  } catch {
    return trimmed
  }
}

/** Accept common Git hosting HTTPS/SSH URLs (not only GitHub). */
export function isValidGitRemoteUrl(repoUrl: string): boolean {
  const value = repoUrl.trim()
  if (!value || value.length > 500) return false

  if (/^git@[A-Za-z0-9._-]+(:\d+)?:[A-Za-z0-9._/-]+(?:\.git)?$/i.test(value)) {
    return true
  }
  if (/^ssh:\/\/git@[A-Za-z0-9._-]+(?::\d+)?\/[A-Za-z0-9._/-]+(?:\.git)?$/i.test(value)) {
    return true
  }

  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
    if (!url.hostname || !url.pathname || url.pathname === '/') return false
    if (url.username || url.password) return false
    return /^[A-Za-z0-9._/-]+(?:\.git)?$/i.test(url.pathname.slice(1))
  } catch {
    return false
  }
}

const BRANCH_NAME = /^[A-Za-z0-9._/-]+$/

export function normalizeGitBranch(value: string): string {
  const branch = value.trim() || 'main'
  if (
    branch.length > 200
    || !BRANCH_NAME.test(branch)
    || branch.startsWith('-')
    || branch.startsWith('/')
    || branch.endsWith('/')
    || branch.endsWith('.')
    || branch.includes('..')
    || branch.includes('//')
    || branch.includes('@{')
  ) {
    throw new Error('分支名称无效')
  }
  return branch
}
