import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ark-note-vault-read-'))
const bundlePath = path.join(testRoot, 'vault-read.cjs')
const require = createRequire(import.meta.url)

await build({
  entryPoints: [path.join(projectRoot, 'shared', 'vaultRead.ts')],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  outfile: bundlePath,
})

const { VaultReader, createMemoryFileAccess, looksLikeVault } = require(bundlePath)

const IV_LENGTH = 12
const TAG_LENGTH = 16
const SALT_LENGTH = 32
const KEY_LENGTH = 32
const PBKDF2_ITERATIONS = 600000

function encrypt(data, key) {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted])
}

async function main() {
  const password = 'correct-horse-battery-staple-12'
  const salt = crypto.randomBytes(SALT_LENGTH)
  const key = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha512')
  const noteId = crypto.randomUUID()
  const metadata = {
    directories: [],
    notes: [{
      id: noteId,
      title: 'Hello Vault',
      directoryId: 'root',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      order: 0,
    }],
    tags: [],
  }
  const noteBody = '# Hello Vault\n\nsearchable body content'
  const files = new Map([
    ['salt.bin', salt],
    ['verify.enc', encrypt(Buffer.from('ARK-NOTE-VERIFY'), key)],
    ['metadata.json.enc', encrypt(Buffer.from(JSON.stringify(metadata)), key)],
    [`notes/${noteId}.md.enc`, encrypt(Buffer.from(noteBody), key)],
  ])

  assert.equal(looksLikeVault(files), true)

  const reader = new VaultReader(createMemoryFileAccess(files))
  await assert.rejects(() => reader.unlock('wrong-password-xxxxxx'), /invalid password/)
  await reader.unlock(password)
  assert.equal(reader.listNotes()[0].title, 'Hello Vault')
  assert.equal(await reader.getNoteContent(noteId), noteBody)
  const hits = await reader.search('searchable')
  assert.equal(hits.length, 1)
  assert.equal(hits[0].noteId, noteId)
  reader.lock()
  assert.equal(reader.isUnlocked(), false)
  console.log('vaultRead shared module tests passed.')
}

try {
  await main()
} finally {
  fs.rmSync(testRoot, { recursive: true, force: true })
}
