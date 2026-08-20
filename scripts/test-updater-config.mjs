import assert from 'node:assert/strict'
import fs from 'node:fs'

const packageJsonRaw = fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')
// A UTF-8 BOM makes JSON.parse (and electron-builder metadata parsers) throw in CI.
assert.ok(!packageJsonRaw.startsWith('\uFEFF'), 'package.json must not start with a UTF-8 BOM')
const packageJson = JSON.parse(packageJsonRaw)
const workflow = fs.readFileSync(new URL('../.github/workflows/package.yml', import.meta.url), 'utf8')

assert.ok(packageJson.dependencies['electron-updater'], 'electron-updater dependency is required')
assert.deepEqual(packageJson.build.publish, [{
  provider: 'github',
  owner: 'loong27',
  repo: 'ArkNote',
}])
assert.match(workflow, /release\/latest\*\.yml/)
assert.match(workflow, /release\/\*\.blockmap/)
assert.match(workflow, /-Filter latest\*\.yml/)
assert.match(workflow, /-Filter \*\.blockmap/)

console.log('GitHub Release updater configuration tests passed.')
