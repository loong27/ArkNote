import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { build } from 'esbuild'

const root = process.cwd()
const result = await build({
  entryPoints: [path.join(root, 'electron', 'services', 'coldArchive.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  write: false,
})
const sourceUrl = `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`
const { packColdArchive, unpackColdArchive, validateColdVaultDir, COLD_ARCHIVE_FORMAT } = await import(sourceUrl)

const src = fs.mkdtempSync(path.join(os.tmpdir(), 'arknote-cold-src-'))
const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'arknote-cold-dst-'))

try {
  fs.writeFileSync(path.join(src, 'salt.bin'), Buffer.alloc(32, 7))
  fs.writeFileSync(path.join(src, 'verify.enc'), Buffer.alloc(48, 8))
  fs.writeFileSync(path.join(src, 'metadata.json.enc'), Buffer.alloc(64, 9))
  fs.mkdirSync(path.join(src, 'notes'))
  fs.writeFileSync(path.join(src, 'notes', 'a.enc'), Buffer.from('cipher-a'))
  fs.mkdirSync(path.join(src, '.git'))
  fs.writeFileSync(path.join(src, '.git', 'config'), 'should-skip')

  const blob = packColdArchive(src)
  assert.ok(blob.length > 16)

  const files = unpackColdArchive(blob, dest)
  assert.ok(files.includes('salt.bin'))
  assert.ok(files.includes('notes/a.enc'))
  assert.ok(!files.some((f) => f.startsWith('.git')))
  assert.equal(fs.readFileSync(path.join(dest, 'notes', 'a.enc')).toString('utf8'), 'cipher-a')
  validateColdVaultDir(dest)

  const headerLen = blob.readUInt32BE(0)
  const manifest = JSON.parse(blob.subarray(8, 8 + headerLen).toString('utf8'))
  assert.equal(manifest.format, COLD_ARCHIVE_FORMAT)

  console.log('cold archive pack/unpack tests passed.')
} finally {
  fs.rmSync(src, { recursive: true, force: true })
  fs.rmSync(dest, { recursive: true, force: true })
}
