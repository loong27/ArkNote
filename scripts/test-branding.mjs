import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const bundle = await build({
  entryPoints: [path.join(projectRoot, 'shared', 'brand.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  write: false,
})
const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
const brand = await import(moduleUrl)

assert.equal(brand.BRAND_NAME, 'arkNote')
assert.equal(brand.BRAND_SLUG, 'ark-note')
assert.equal(brand.BRAND_ID, 'arknote')

const legacyId = `${String.fromCharCode(122, 122)}note`
const legacyMarkdown = [
  `![cover](${legacyId}://image-1)`,
  `[related](${legacyId}-link://note-2)`,
  `<img src="${legacyId}://image-3" data-${legacyId}-width="640" />`,
].join('\n')
const migratedMarkdown = brand.migrateLegacyBrandReferences(legacyMarkdown)

assert.equal(migratedMarkdown.includes(legacyId), false)
assert.equal(migratedMarkdown.includes('arknote://image-1'), true)
assert.equal(migratedMarkdown.includes('arknote-link://note-2'), true)
assert.equal(migratedMarkdown.includes('data-arknote-width="640"'), true)

const legacyPrefix = String.fromCharCode(122, 122)
const forbiddenName = new RegExp(`${legacyPrefix}(?:[-_ ]?note)`, 'i')
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.md', '.mjs', '.ts', '.tsx', '.yaml', '.yml'])
const trackedFiles = execFileSync('git', ['ls-files', '-z'], { cwd: projectRoot })
  .toString('utf8')
  .split('\0')
  .filter(Boolean)

for (const relativePath of trackedFiles) {
  if (relativePath.startsWith('dist-electron/')) continue
  if (!textExtensions.has(path.extname(relativePath).toLowerCase())) continue
  const content = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8')
  assert.equal(forbiddenName.test(content), false, `Legacy brand name remains in ${relativePath}`)
}

console.log('arkNote branding compatibility tests passed.')
