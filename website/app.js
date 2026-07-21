const REPOSITORY = 'loong27/ArkNote'
const RELEASE_API = `https://api.github.com/repos/${REPOSITORY}/releases/latest`
const RELEASES_URL = `https://github.com/${REPOSITORY}/releases/latest`
const CACHE_KEY = 'arknote-latest-release-v1'
const CACHE_MAX_AGE = 30 * 60 * 1000

const PACKAGE_RULES = [
  { key: 'windows-x64', test: /arkNote-Setup-[^-]+-x64\.exe$/i },
  { key: 'windows-x86', test: /arkNote-Setup-[^-]+-ia32\.exe$/i },
  { key: 'linux-appimage', test: /arkNote-[^-]+-x86_64\.AppImage$/i },
  { key: 'linux-deb', test: /arkNote-[^-]+-amd64\.deb$/i },
  { key: 'linux-rpm', test: /arkNote-[^-]+-x86_64\.rpm$/i },
]

export function resolveReleasePackages(release) {
  const assets = Array.isArray(release?.assets) ? release.assets : []
  const packages = {}

  for (const rule of PACKAGE_RULES) {
    const asset = assets.find((candidate) => rule.test.test(candidate?.name || ''))
    if (asset && isTrustedDownloadUrl(asset.browser_download_url)) {
      packages[rule.key] = {
        name: asset.name,
        size: Number(asset.size) || 0,
        url: asset.browser_download_url,
      }
    }
  }

  return packages
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / (1024 ** unitIndex)
  return `${value >= 100 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`
}

export function detectPlatform(userAgent = '', platform = '') {
  const source = `${userAgent} ${platform}`.toLowerCase()
  if (/android|iphone|ipad|ipod|mobile/.test(source)) return 'mobile'
  if (/windows|win32|win64/.test(source)) return 'windows'
  if (/linux|x11/.test(source)) return 'linux'
  if (/macintosh|macintel|mac os/.test(source)) return 'macos'
  return 'other'
}

function isTrustedDownloadUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
      && url.hostname === 'github.com'
      && url.pathname.startsWith(`/${REPOSITORY}/releases/download/`)
  } catch {
    return false
  }
}

function getCachedRelease() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
    if (!cached || Date.now() - cached.savedAt > CACHE_MAX_AGE) return null
    return cached.release
  } catch {
    return null
  }
}

function setCachedRelease(release) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), release }))
  } catch {
    // Storage may be disabled; the live release response is still usable.
  }
}

async function fetchLatestRelease() {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`GitHub API returned ${response.status}`)

    const release = await response.json()
    if (!release?.tag_name || release.draft || release.prerelease) {
      throw new Error('The latest release is not a stable public release')
    }
    return release
  } finally {
    window.clearTimeout(timeout)
  }
}

async function getClientInfo() {
  const userAgent = navigator.userAgent || ''
  const legacyPlatform = navigator.platform || ''
  const platform = detectPlatform(userAgent, navigator.userAgentData?.platform || legacyPlatform)
  const architectureSource = `${userAgent} ${legacyPlatform}`
  let architecture = /(?:x86|i[3-6]86)/i.test(architectureSource) ? 'x86' : 'x64'
  if (platform === 'windows' && !/(?:win64|wow64|x64|arm64)/i.test(architectureSource)) {
    architecture = 'x86'
  }

  if (navigator.userAgentData?.getHighEntropyValues) {
    try {
      const values = await navigator.userAgentData.getHighEntropyValues(['architecture', 'bitness'])
      if (values.bitness === '32' || values.architecture === 'x86') architecture = 'x86'
      if (values.bitness === '64') architecture = 'x64'
    } catch {
      // High-entropy hints are optional and not available in every browser.
    }
  }

  return { platform, architecture }
}

function packageKeyForClient(client) {
  if (client.platform === 'windows') {
    return client.architecture === 'x86' ? 'windows-x86' : 'windows-x64'
  }
  if (client.platform === 'linux') return 'linux-appimage'
  return null
}

function packageLabel(key) {
  return {
    'windows-x64': 'Windows 64 位',
    'windows-x86': 'Windows 32 位',
    'linux-appimage': 'Linux AppImage',
    'linux-deb': 'Linux DEB',
    'linux-rpm': 'Linux RPM',
  }[key] || '桌面版'
}

function formatReleaseDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

function activatePlatform(platform) {
  const target = platform === 'linux' ? 'linux' : 'windows'
  document.querySelectorAll('[data-platform]').forEach((tab) => {
    const active = tab.dataset.platform === target
    tab.classList.toggle('active', active)
    tab.setAttribute('aria-selected', String(active))
    tab.tabIndex = active ? 0 : -1
  })

  document.querySelectorAll('.package-panel').forEach((panel) => {
    panel.hidden = panel.id !== `panel-${target}`
  })
}

function updateDownloadLinks(release, client) {
  const packages = resolveReleasePackages(release)
  const tag = release.tag_name
  const published = formatReleaseDate(release.published_at)

  document.querySelectorAll('[data-package]').forEach((link) => {
    const key = link.dataset.package
    const asset = packages[key]
    const description = link.querySelector('.package-copy small')
    const baseDescription = description?.dataset.baseText || description?.textContent || ''
    if (description && !description.dataset.baseText) description.dataset.baseText = baseDescription

    if (asset) {
      link.href = asset.url
      link.classList.remove('unavailable')
      link.title = `下载 ${asset.name}`
      if (description) {
        const size = formatBytes(asset.size)
        description.textContent = size ? `${baseDescription} · ${size}` : baseDescription
      }
    } else {
      link.href = RELEASES_URL
      link.classList.add('unavailable')
      link.title = '前往 GitHub Releases 查看可用文件'
      if (description) description.textContent = `${baseDescription} · 当前版本未提供`
    }
  })

  const suggestedKey = packageKeyForClient(client)
  const suggestedAsset = suggestedKey ? packages[suggestedKey] : null
  const primary = document.querySelector('#primary-download')
  const primaryText = primary?.querySelector('span')

  if (suggestedAsset) {
    primary.href = suggestedAsset.url
    primary.title = `下载 ${suggestedAsset.name}`
    if (primaryText) primaryText.textContent = `下载 ${packageLabel(suggestedKey)}`
  } else {
    primary.href = '#download'
    primary.removeAttribute('title')
    if (primaryText) primaryText.textContent = '查看桌面版下载'
  }

  document.querySelector('#release-version').textContent = `${tag} 最新正式版`
  document.querySelector('#release-date').textContent = published ? `发布于 ${published}` : 'GitHub 正式发行版'
  document.querySelector('#hero-release').textContent = suggestedKey && suggestedAsset
    ? `${tag} · ${packageLabel(suggestedKey)} · ${published}`
    : `${tag} · Windows 与 Linux 桌面版 · ${published}`
  document.querySelector('#download-status').textContent = `已连接 GitHub Releases，共匹配 ${Object.keys(packages).length} 个安装包。`
}

function showReleaseFallback(client) {
  const primary = document.querySelector('#primary-download')
  const primaryText = primary?.querySelector('span')
  primary.href = client.platform === 'mobile' || client.platform === 'macos' ? '#download' : RELEASES_URL
  if (primaryText) primaryText.textContent = client.platform === 'mobile' || client.platform === 'macos'
    ? '查看桌面版下载'
    : '前往 GitHub 下载'

  document.querySelector('#hero-release').textContent = '安装包由 GitHub Releases 提供'
  document.querySelector('#release-version').textContent = '最新正式版'
  document.querySelector('#release-date').textContent = '由 GitHub Releases 自动更新'
  document.querySelector('#download-status').textContent = '暂未读取到版本信息，点击安装包将前往 GitHub Releases。'
}

function setupTabs() {
  const tabs = [...document.querySelectorAll('[data-platform]')]
  for (const tab of tabs) {
    tab.addEventListener('click', () => activatePlatform(tab.dataset.platform))
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
      event.preventDefault()
      const currentIndex = tabs.indexOf(tab)
      const direction = event.key === 'ArrowRight' ? 1 : -1
      const nextTab = tabs[(currentIndex + direction + tabs.length) % tabs.length]
      activatePlatform(nextTab.dataset.platform)
      nextTab.focus()
    })
  }
}

function setupRevealAnimations() {
  const items = document.querySelectorAll('.reveal')
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    items.forEach((item) => item.classList.add('visible'))
    return
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return
      entry.target.classList.add('visible')
      observer.unobserve(entry.target)
    })
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })

  items.forEach((item) => observer.observe(item))
}

async function initialize() {
  document.querySelector('#current-year').textContent = String(new Date().getFullYear())
  setupTabs()
  setupRevealAnimations()

  const client = await getClientInfo()
  activatePlatform(client.platform)

  const cachedRelease = getCachedRelease()
  if (cachedRelease) updateDownloadLinks(cachedRelease, client)

  try {
    const release = await fetchLatestRelease()
    setCachedRelease(release)
    updateDownloadLinks(release, client)
  } catch {
    if (!cachedRelease) showReleaseFallback(client)
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  void initialize()
}
