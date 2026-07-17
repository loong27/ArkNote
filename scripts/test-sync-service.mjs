import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tempPrefix = path.join(os.tmpdir(), 'zz-note-sync-test-')
const testRoot = fs.mkdtempSync(tempPrefix)
const require = createRequire(import.meta.url)

process.env.GIT_AUTHOR_NAME = 'ZZ-Note Test'
process.env.GIT_AUTHOR_EMAIL = 'zz-note-test@local'
process.env.GIT_COMMITTER_NAME = 'ZZ-Note Test'
process.env.GIT_COMMITTER_EMAIL = 'zz-note-test@local'

function git(cwd, ...args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function writeEncryptedFixture(directory, value) {
  fs.mkdirSync(directory, { recursive: true })
  fs.writeFileSync(path.join(directory, 'metadata.json.enc'), Buffer.from([0, ...Buffer.from(value)]))
}

function readEncryptedFixture(directory) {
  return fs.readFileSync(path.join(directory, 'metadata.json.enc'))
}

function assertNoGitOperation(directory) {
  const gitDir = path.join(directory, '.git')
  assert.equal(fs.existsSync(path.join(gitDir, 'MERGE_HEAD')), false, 'merge must be complete')
  assert.equal(fs.existsSync(path.join(gitDir, 'rebase-merge')), false, 'rebase-merge must not remain')
  assert.equal(fs.existsSync(path.join(gitDir, 'rebase-apply')), false, 'rebase-apply must not remain')
  assert.equal(git(directory, 'status', '--porcelain'), '', 'working tree must be clean')
}

function createRemote(name, initialValue) {
  const remote = path.join(testRoot, `${name}.git`)
  const seed = path.join(testRoot, `${name}-seed`)

  fs.mkdirSync(remote, { recursive: true })
  git(remote, 'init', '--bare', '--initial-branch=main')

  fs.mkdirSync(seed, { recursive: true })
  git(seed, 'init', '--initial-branch=main')
  git(seed, 'config', 'user.name', 'ZZ-Note Test')
  git(seed, 'config', 'user.email', 'zz-note-test@local')
  writeEncryptedFixture(seed, initialValue)
  git(seed, 'add', '.')
  git(seed, 'commit', '-m', 'Initial remote data')
  git(seed, 'remote', 'add', 'origin', remote)
  git(seed, 'push', '-u', 'origin', 'main')

  return remote
}

async function loadSyncService() {
  const bundlePath = path.join(testRoot, 'sync-service.cjs')
  await build({
    entryPoints: [path.join(projectRoot, 'electron/services/syncService.ts')],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    outfile: bundlePath,
  })
  return require(bundlePath)
}

function syncConfig(remote) {
  return {
    enabled: true,
    provider: 'git',
    repoUrl: remote,
    branch: 'main',
    ossEndpoint: '',
    ossBucket: '',
    ossAccessKey: '',
    ossSecretKey: '',
    ossRegion: '',
    autoSync: false,
    syncInterval: 30,
  }
}

async function run() {
  const { SyncService } = await loadSyncService()
  const remote = createRemote('two-device', 'base')
  const deviceA = path.join(testRoot, 'device-a')
  const deviceB = path.join(testRoot, 'device-b')

  git(testRoot, 'clone', remote, deviceA)
  git(testRoot, 'clone', remote, deviceB)

  const serviceA = new SyncService(deviceA)
  const serviceB = new SyncService(deviceB)
  await serviceA.configure(syncConfig(remote))
  await serviceB.configure(syncConfig(remote))

  writeEncryptedFixture(deviceA, 'device-a-remote-choice')
  assert.equal((await serviceA.push()).status, 'success')

  writeEncryptedFixture(deviceB, 'device-b-discarded')
  const remoteConflict = await serviceB.pull()
  assert.equal(remoteConflict.status, 'conflict')
  assert.deepEqual(remoteConflict.conflicts?.map(item => item.file), ['metadata.json.enc'])
  assert.equal((await serviceB.resolveConflicts([
    { file: 'metadata.json.enc', resolution: 'remote' },
  ])).status, 'success')
  assert.deepEqual(readEncryptedFixture(deviceB), readEncryptedFixture(deviceA))
  assertNoGitOperation(deviceB)

  writeEncryptedFixture(deviceB, 'device-b-local-choice')
  writeEncryptedFixture(deviceA, 'device-a-discarded')
  assert.equal((await serviceA.push()).status, 'success')

  const localConflict = await serviceB.pull()
  assert.equal(localConflict.status, 'conflict')
  assert.equal((await serviceB.resolveConflicts([
    { file: 'metadata.json.enc', resolution: 'local' },
  ])).status, 'success')
  assert.deepEqual(readEncryptedFixture(deviceB), Buffer.from([0, ...Buffer.from('device-b-local-choice')]))
  assertNoGitOperation(deviceB)

  assert.equal((await serviceA.pull()).status, 'success')
  writeEncryptedFixture(deviceB, 'device-b-modify-before-delete')
  fs.rmSync(path.join(deviceA, 'metadata.json.enc'))
  assert.equal((await serviceA.push()).status, 'success')

  const deleteConflict = await serviceB.pull()
  assert.equal(deleteConflict.status, 'conflict')
  assert.equal((await serviceB.resolveConflicts([
    { file: 'metadata.json.enc', resolution: 'remote' },
  ])).status, 'success')
  assert.equal(fs.existsSync(path.join(deviceB, 'metadata.json.enc')), false)
  assertNoGitOperation(deviceB)

  const existingRemote = createRemote('unrelated-history', 'existing-remote')
  const newLocal = path.join(testRoot, 'new-local')
  writeEncryptedFixture(newLocal, 'new-local-data')
  const newLocalService = new SyncService(newLocal)
  await newLocalService.configure(syncConfig(existingRemote))

  const unrelatedConflict = await newLocalService.pull()
  assert.equal(unrelatedConflict.status, 'conflict', JSON.stringify(unrelatedConflict))
  assert.equal((await newLocalService.resolveConflicts([
    { file: 'metadata.json.enc', resolution: 'local' },
  ])).status, 'success')
  assert.deepEqual(readEncryptedFixture(newLocal), Buffer.from([0, ...Buffer.from('new-local-data')]))
  assertNoGitOperation(newLocal)

  const legacyRemote = createRemote('legacy-rebase', 'legacy-base')
  const legacyA = path.join(testRoot, 'legacy-a')
  const legacyB = path.join(testRoot, 'legacy-b')
  git(testRoot, 'clone', legacyRemote, legacyA)
  git(testRoot, 'clone', legacyRemote, legacyB)

  writeEncryptedFixture(legacyA, 'legacy-remote-change')
  git(legacyA, 'add', '.')
  git(legacyA, 'commit', '-m', 'Remote change')
  git(legacyA, 'push', 'origin', 'main')

  writeEncryptedFixture(legacyB, 'legacy-local-change')
  git(legacyB, 'add', '.')
  git(legacyB, 'commit', '-m', 'Local change')
  assert.throws(() => git(legacyB, 'pull', '--rebase', 'origin', 'main'))
  assert.equal(fs.existsSync(path.join(legacyB, '.git', 'rebase-merge')), true)

  const legacyService = new SyncService(legacyB)
  await legacyService.configure(syncConfig(legacyRemote))
  assert.equal(fs.existsSync(path.join(legacyB, '.git', 'rebase-merge')), false)
  const recoveredConflict = await legacyService.pull()
  assert.equal(recoveredConflict.status, 'conflict')
  assert.equal((await legacyService.resolveConflicts([
    { file: 'metadata.json.enc', resolution: 'local' },
  ])).status, 'success')
  assertNoGitOperation(legacyB)

  serviceA.cleanup()
  serviceB.cleanup()
  newLocalService.cleanup()
  legacyService.cleanup()
  console.log('SyncService integration tests passed.')
}

try {
  await run()
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exitCode = 1
} finally {
  const resolvedRoot = path.resolve(testRoot)
  if (!resolvedRoot.startsWith(path.resolve(tempPrefix))) {
    throw new Error(`Refusing to remove unexpected test directory: ${resolvedRoot}`)
  }
  fs.rmSync(resolvedRoot, { recursive: true, force: true })
}
