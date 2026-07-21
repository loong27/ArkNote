import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { detectPlatform, formatBytes, resolveReleasePackages } from '../website/app.js'

const root = resolve(import.meta.dirname, '..')
const html = await readFile(resolve(root, 'website/index.html'), 'utf8')
const css = await readFile(resolve(root, 'website/styles.css'), 'utf8')
const manifest = JSON.parse(await readFile(resolve(root, 'website/site.webmanifest'), 'utf8'))

assert.match(html, /<html lang="zh-CN">/)
assert.match(html, /<meta name="description"/)
assert.match(html, /<link rel="canonical" href="https:\/\/loong27\.github\.io\/ArkNote\/"/)
assert.match(html, /application\/ld\+json/)
assert.match(html, /id="primary-download"/)
assert.match(html, /data-package="windows-x64"/)
assert.match(html, /data-package="linux-appimage"/)
assert.match(css, /@media \(max-width: 700px\)/)
assert.equal(manifest.name, 'arkNote')
const socialImage = await stat(resolve(root, 'website/assets/og-cover.png'))
assert.ok(socialImage.size > 20_000, 'Social preview image should be generated')
const socialImageMetadata = await sharp(resolve(root, 'website/assets/og-cover.png')).metadata()
assert.equal(socialImageMetadata.width, 1200)
assert.equal(socialImageMetadata.height, 630)

const release = {
  assets: [
    { name: 'arkNote-Setup-1.2.3-x64.exe', size: 101_000_000, browser_download_url: 'https://github.com/loong27/ArkNote/releases/download/v1.2.3/arkNote-Setup-1.2.3-x64.exe' },
    { name: 'arkNote-Setup-1.2.3-ia32.exe', size: 96_000_000, browser_download_url: 'https://github.com/loong27/ArkNote/releases/download/v1.2.3/arkNote-Setup-1.2.3-ia32.exe' },
    { name: 'arkNote-1.2.3-x86_64.AppImage', size: 110_000_000, browser_download_url: 'https://github.com/loong27/ArkNote/releases/download/v1.2.3/arkNote-1.2.3-x86_64.AppImage' },
    { name: 'arkNote-1.2.3-amd64.deb', size: 88_000_000, browser_download_url: 'https://github.com/loong27/ArkNote/releases/download/v1.2.3/arkNote-1.2.3-amd64.deb' },
    { name: 'arkNote-1.2.3-x86_64.rpm', size: 92_000_000, browser_download_url: 'https://github.com/loong27/ArkNote/releases/download/v1.2.3/arkNote-1.2.3-x86_64.rpm' },
    { name: 'arkNote-Setup-1.2.3-x64.exe.blockmap', size: 12, browser_download_url: 'https://github.com/loong27/ArkNote/releases/download/v1.2.3/arkNote-Setup-1.2.3-x64.exe.blockmap' },
    { name: 'untrusted.exe', size: 12, browser_download_url: 'https://example.com/untrusted.exe' },
  ],
}

const packages = resolveReleasePackages(release)
assert.deepEqual(Object.keys(packages).sort(), [
  'linux-appimage',
  'linux-deb',
  'linux-rpm',
  'windows-x64',
  'windows-x86',
])
assert.equal(packages['windows-x64'].name, 'arkNote-Setup-1.2.3-x64.exe')
assert.equal(detectPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'windows')
assert.equal(detectPlatform('Mozilla/5.0 (X11; Linux x86_64)'), 'linux')
assert.equal(detectPlatform('Mozilla/5.0 (Linux; Android 15; Mobile)'), 'mobile')
assert.equal(formatBytes(104857600), '100 MB')

console.log('Website SEO, responsive structure, and release resolution tests passed.')
