import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tempPrefix = path.join(os.tmpdir(), 'zz-note-auth-test-')
const testRoot = fs.mkdtempSync(tempPrefix)
const require = createRequire(import.meta.url)

async function loadModule(relativePath, outputName) {
  const bundlePath = path.join(testRoot, outputName)
  await build({
    entryPoints: [path.join(projectRoot, relativePath)],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    outfile: bundlePath,
  })
  return require(bundlePath)
}

class MemoryThrottleStore {
  constructor() {
    this.entries = new Map()
  }

  getAuthThrottle(key) {
    const value = this.entries.get(key)
    return value ? { ...value } : null
  }

  setAuthThrottle(key, value) {
    this.entries.set(key, { ...value })
  }

  clearAuthThrottle(key) {
    this.entries.delete(key)
  }
}

async function testPasswordPolicy(auth) {
  assert.equal(auth.validateNewPassword('StrongPass12!').valid, true)
  assert.equal(auth.validateNewPassword('correct horse battery staple').valid, true)
  assert.equal(auth.validateNewPassword('Short1!').valid, false)
  assert.equal(auth.validateNewPassword('123456789012').valid, false)
  assert.equal(auth.validateNewPassword('aaaaaaaaaaaa').valid, false)
  assert.equal(auth.validateNewPassword('abcdefghijkl').valid, false)
  assert.equal(auth.validateNewPassword('password1234').valid, false)
  assert.equal(auth.validatePasswordInput('😀'.repeat(257)).valid, false)
}

async function testAttemptLimiter(auth) {
  let now = 1_000_000
  const store = new MemoryThrottleStore()
  const limiter = new auth.AuthAttemptLimiter('vault', store, () => now, () => 0)

  assert.deepEqual(limiter.recordFailure(), { failedAttempts: 1, retryAfterMs: 0 })
  assert.deepEqual(limiter.recordFailure(), { failedAttempts: 2, retryAfterMs: 0 })
  assert.deepEqual(limiter.recordFailure(), { failedAttempts: 3, retryAfterMs: 1000 })
  assert.deepEqual(limiter.getStatus(), { failedAttempts: 3, retryAfterMs: 1000 })

  now += 1000
  assert.deepEqual(limiter.recordFailure(), { failedAttempts: 4, retryAfterMs: 2000 })

  let currentDelay = 2000
  for (let attempt = 5; attempt <= 12; attempt += 1) {
    now += currentDelay
    const result = limiter.recordFailure()
    assert.equal(result.failedAttempts, attempt)
    currentDelay = result.retryAfterMs
  }
  assert.equal(currentDelay, 5 * 60 * 1000)

  const restoredLimiter = new auth.AuthAttemptLimiter('vault', store, () => now, () => 0)
  assert.deepEqual(restoredLimiter.getStatus(), { failedAttempts: 12, retryAfterMs: 5 * 60 * 1000 })

  now += 24 * 60 * 60 * 1000
  assert.deepEqual(restoredLimiter.getStatus(), { failedAttempts: 0, retryAfterMs: 0 })
  assert.equal(store.getAuthThrottle('vault'), null)

  const order = []
  let releaseFirst
  let markFirstStarted
  const firstStarted = new Promise(resolve => {
    markFirstStarted = resolve
  })
  const firstGate = new Promise(resolve => {
    releaseFirst = resolve
  })

  const first = limiter.runExclusive(async () => {
    order.push('first-start')
    markFirstStarted()
    await firstGate
    order.push('first-end')
  })
  await firstStarted
  const second = limiter.runExclusive(async () => {
    order.push('second')
  })
  await Promise.resolve()
  assert.deepEqual(order, ['first-start'])
  releaseFirst()
  await Promise.all([first, second])
  assert.deepEqual(order, ['first-start', 'first-end', 'second'])
}

async function testEncryptionFailsClosed(encryptionModule) {
  const { EncryptionService, VaultIntegrityError } = encryptionModule
  const password = 'Strong vault password 2026!'
  const newPassword = 'New strong vault password 2026!'
  const vaultDir = path.join(testRoot, 'vault')
  const service = new EncryptionService(vaultDir)

  assert.equal(service.isFirstTime(), true)
  assert.equal(await service.unlock(password), true)
  assert.equal(fs.existsSync(path.join(vaultDir, 'salt.bin')), true)
  assert.equal(fs.existsSync(path.join(vaultDir, 'verify.enc')), true)

  service.encryptStringToFile(path.join(vaultDir, 'metadata.json.enc'), 'encrypted fixture')
  service.lock()
  assert.equal(await service.unlock('Wrong vault password 2026!'), false)
  assert.equal(service.isLocked(), true)
  assert.equal(await service.unlock(password), true)
  assert.equal(await service.changePassword(password, newPassword), true)
  service.lock()
  assert.equal(await service.unlock(password), false)
  assert.equal(await service.unlock(newPassword), true)
  assert.equal(service.decryptFileToString(path.join(vaultDir, 'metadata.json.enc')), 'encrypted fixture')
  service.lock()

  fs.rmSync(path.join(vaultDir, 'verify.enc'))
  await assert.rejects(
    service.unlock(newPassword),
    error => error instanceof VaultIntegrityError && error.message.includes('verify.enc'),
  )
  assert.equal(fs.existsSync(path.join(vaultDir, 'verify.enc')), false)

  const missingSaltDir = path.join(testRoot, 'missing-salt')
  fs.mkdirSync(missingSaltDir, { recursive: true })
  fs.writeFileSync(path.join(missingSaltDir, 'metadata.json.enc'), Buffer.from('existing encrypted data'))
  const missingSaltService = new EncryptionService(missingSaltDir)
  assert.equal(missingSaltService.isFirstTime(), false)
  await assert.rejects(
    missingSaltService.unlock(password),
    error => error instanceof VaultIntegrityError && error.message.includes('salt.bin'),
  )
  assert.equal(fs.existsSync(path.join(missingSaltDir, 'salt.bin')), false)

  const corruptSaltDir = path.join(testRoot, 'corrupt-salt')
  fs.mkdirSync(corruptSaltDir, { recursive: true })
  fs.writeFileSync(path.join(corruptSaltDir, 'salt.bin'), Buffer.alloc(8))
  fs.writeFileSync(path.join(corruptSaltDir, 'verify.enc'), Buffer.alloc(64))
  const corruptSaltService = new EncryptionService(corruptSaltDir)
  await assert.rejects(
    corruptSaltService.unlock(password),
    error => error instanceof VaultIntegrityError && error.message.includes('salt.bin'),
  )
}

async function run() {
  const auth = await loadModule('electron/services/authSecurity.ts', 'auth-security.cjs')
  const encryption = await loadModule('electron/services/encryption.ts', 'encryption.cjs')

  await testPasswordPolicy(auth)
  await testAttemptLimiter(auth)
  await testEncryptionFailsClosed(encryption)
  console.log('Authentication security tests passed.')
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
