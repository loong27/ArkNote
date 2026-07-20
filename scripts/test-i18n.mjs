import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { build } from 'esbuild'

const root = process.cwd()
const result = await build({
  entryPoints: [path.join(root, 'shared', 'i18n.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  write: false,
})
const sourceUrl = `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`
const i18n = await import(sourceUrl)

const translations = i18n.getEnglishTranslations()
assert.ok(Object.keys(translations).length >= 200, 'English translation catalog is unexpectedly small')

const sourceFiles = []
function collect(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) collect(fullPath)
    else if (/\.(?:ts|tsx)$/.test(entry.name)) sourceFiles.push(fullPath)
  }
}
collect(path.join(root, 'src'))
collect(path.join(root, 'electron'))

const missing = new Set()
const literalCall = /\b(?:t|tr)\(\s*'((?:\\'|[^'])+)'/g
for (const file of sourceFiles) {
  const content = fs.readFileSync(file, 'utf8')
  for (const match of content.matchAll(literalCall)) {
    const key = match[1].replace(/\\'/g, "'")
    if (/\p{Script=Han}/u.test(key) && !translations[key]) {
      missing.add(`${path.relative(root, file)}: ${key}`)
    }
  }
}
assert.deepEqual([...missing], [], `Missing English translations:\n${[...missing].join('\n')}`)

assert.equal(i18n.normalizeLanguage('en'), 'en-US')
assert.equal(i18n.normalizeLanguage('fr'), 'zh-CN')
assert.equal(i18n.translate('en-US', '下载进度 {progress}%', { progress: 42 }), 'Download progress 42%')
assert.equal(i18n.translate('en-US', '发现新版本 1.2.3'), 'Version 1.2.3 is available')
assert.equal(i18n.translate('en-US', '密码错误，请在 8 秒后重试'), 'Incorrect password. Try again in 8s')
assert.equal(i18n.translate('zh-CN', '设置'), '设置')

console.log(`i18n checks passed (${Object.keys(translations).length} English entries, ${sourceFiles.length} source files)`)
