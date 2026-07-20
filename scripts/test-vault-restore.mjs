import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ark-note-restore-test-'))
const bundlePath = path.join(testRoot, 'vault-restore.cjs')
const require = createRequire(import.meta.url)

await build({
  entryPoints: [path.join(projectRoot, 'electron', 'services', 'vaultRestoreService.ts')],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  outfile: bundlePath,
})

const { VaultRestoreService } = require(bundlePath)

function writeValidVault(targetDir) {
  fs.mkdirSync(path.join(targetDir, '.git'), { recursive: true })
  fs.writeFileSync(path.join(targetDir, 'salt.bin'), Buffer.alloc(32, 1))
  fs.writeFileSync(path.join(targetDir, 'verify.enc'), Buffer.alloc(29, 2))
  fs.writeFileSync(path.join(targetDir, 'metadata.json.enc'), Buffer.alloc(29, 3))
}

async function testSuccessfulRestore() {
  const dataDir = path.join(testRoot, 'restored-vault')
  let cloneRequest = null
  const service = new VaultRestoreService(dataDir, {
    cloneRepository: async (repoUrl, targetDir, branch) => {
      cloneRequest = { repoUrl, branch }
      writeValidVault(targetDir)
    },
  })

  const result = await service.restore({
    repoUrl: 'git@github.com:example/encrypted-notes.git',
    branch: 'main',
  })
  assert.equal(result.success, true)
  assert.deepEqual(cloneRequest, {
    repoUrl: 'git@github.com:example/encrypted-notes.git',
    branch: 'main',
  })
  assert.equal(fs.statSync(path.join(dataDir, 'salt.bin')).size, 32)
  assert.equal(fs.existsSync(path.join(dataDir, '.git')), true)
}

async function testInvalidSourceAndVault() {
  let cloneCalled = false
  const invalidSourceDir = path.join(testRoot, 'invalid-source')
  const invalidSourceService = new VaultRestoreService(invalidSourceDir, {
    cloneRepository: async () => { cloneCalled = true },
  })
  const invalidSource = await invalidSourceService.restore({ repoUrl: 'file:///tmp/vault', branch: 'main' })
  assert.equal(invalidSource.success, false)
  assert.equal(cloneCalled, false)
  assert.equal(fs.existsSync(invalidSourceDir), false)

  const invalidVaultDir = path.join(testRoot, 'invalid-vault')
  const invalidVaultService = new VaultRestoreService(invalidVaultDir, {
    cloneRepository: async (_repoUrl, targetDir) => {
      fs.mkdirSync(path.join(targetDir, '.git'), { recursive: true })
      fs.writeFileSync(path.join(targetDir, 'salt.bin'), Buffer.alloc(32))
    },
  })
  const invalidVault = await invalidVaultService.restore({
    repoUrl: 'https://github.com/example/incomplete-vault.git',
    branch: 'main',
  })
  assert.equal(invalidVault.success, false)
  assert.equal(fs.existsSync(invalidVaultDir), false)
}

async function testExistingDataIsNeverOverwritten() {
  const dataDir = path.join(testRoot, 'existing-vault')
  fs.mkdirSync(dataDir, { recursive: true })
  const sentinelPath = path.join(dataDir, 'keep-me.txt')
  fs.writeFileSync(sentinelPath, 'local data')
  let cloneCalled = false
  const service = new VaultRestoreService(dataDir, {
    cloneRepository: async () => { cloneCalled = true },
  })

  const result = await service.restore({
    repoUrl: 'https://github.com/example/encrypted-notes.git',
    branch: 'main',
  })
  assert.equal(result.success, false)
  assert.equal(cloneCalled, false)
  assert.equal(fs.readFileSync(sentinelPath, 'utf8'), 'local data')
}

try {
  await testSuccessfulRestore()
  await testInvalidSourceAndVault()
  await testExistingDataIsNeverOverwritten()
  console.log('Vault restore safety tests passed.')
} finally {
  fs.rmSync(testRoot, { recursive: true, force: true })
}
