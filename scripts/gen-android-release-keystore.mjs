#!/usr/bin/env node
/**
 * Generate a long-lived Android release keystore outside the repo,
 * print backup instructions, and optionally push GitHub Actions secrets via `gh`.
 *
 * Usage:
 *   node scripts/gen-android-release-keystore.mjs
 *   node scripts/gen-android-release-keystore.mjs --set-secrets
 */
import { execFileSync, spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const setSecrets = process.argv.includes('--set-secrets')
const alias = 'arknote'
const certsDir = path.join(os.homedir(), '.arknote-certs')
const keystorePath = path.join(certsDir, 'arknote-reader-release.jks')
const envPath = path.join(certsDir, 'arknote-reader-release.env')

function randomPassword() {
  return crypto.randomBytes(24).toString('base64url')
}

function findKeytool() {
  const candidates = []
  if (process.env.JAVA_HOME) {
    candidates.push(path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'keytool.exe' : 'keytool'))
  }
  candidates.push(
    'C:\\Program Files\\Android\\Android Studio\\jbr\\bin\\keytool.exe',
    'C:\\Program Files\\JetBrains\\PyCharm 2026.1.4\\jbr\\bin\\keytool.exe',
    'C:\\Program Files\\Eclipse Adoptium\\jdk-21\\bin\\keytool.exe',
    'C:\\Program Files\\Microsoft\\jdk-21\\bin\\keytool.exe',
    '/usr/bin/keytool',
  )
  for (const c of candidates) {
    if (!c) continue
    const base = path.basename(c)
    if ((base === 'keytool.exe' || base === 'keytool') && fs.existsSync(c)) return c
  }
  const which = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', ['keytool'], { encoding: 'utf8' })
  if (which.status === 0) {
    const line = which.stdout.split(/\r?\n/).map(s => s.trim()).find(Boolean)
    if (line) return line
  }
  return null
}

function generateWithKeytool(keytool, storePassword, keyPassword) {
  execFileSync(keytool, [
    '-genkeypair',
    '-v',
    '-keystore', keystorePath,
    '-storetype', 'PKCS12',
    '-keyalg', 'RSA',
    '-keysize', '2048',
    '-validity', '10000',
    '-alias', alias,
    '-storepass', storePassword,
    '-keypass', keyPassword,
    '-dname', 'CN=arkNote Reader, OU=arkNote, O=arkNote, L=Unknown, ST=Unknown, C=US',
  ], { stdio: 'inherit' })
}

function generateWithPowerShell(storePassword) {
  if (process.platform !== 'win32') {
    throw new Error('keytool not found. Install a JDK (or Android Studio JBR) and ensure keytool is on PATH.')
  }
  const ps1 = path.join(certsDir, '_gen-android-cert.ps1')
  const script = `
$ErrorActionPreference = 'Stop'
$pass = ConvertTo-SecureString -String @'
${storePassword}
'@ -Force -AsPlainText
$notAfter = (Get-Date).AddDays(10000)
$cert = New-SelfSignedCertificate -FriendlyName '${alias}' -Subject 'CN=arkNote Reader' -CertStoreLocation 'Cert:\\CurrentUser\\My' -KeyAlgorithm RSA -KeyLength 2048 -HashAlgorithm SHA256 -NotAfter $notAfter -KeyExportPolicy Exportable -Provider 'Microsoft Enhanced RSA and AES Cryptographic Provider' -KeyUsage DigitalSignature -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3')
Export-PfxCertificate -Cert $cert -FilePath '${keystorePath.replace(/'/g, "''")}' -Password $pass | Out-Null
Remove-Item -Path ("Cert:\\CurrentUser\\My\\" + $cert.Thumbprint) -Force
`
  fs.writeFileSync(ps1, script, 'utf8')
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1], { stdio: 'inherit' })
  } finally {
    try { fs.unlinkSync(ps1) } catch { /* ignore */ }
  }
  if (!fs.existsSync(keystorePath)) {
    throw new Error('PowerShell failed to create the PFX keystore')
  }
}

fs.mkdirSync(certsDir, { recursive: true })

let storePassword
let keyPassword
if (fs.existsSync(keystorePath) && fs.existsSync(envPath)) {
  console.log(`Keystore already exists: ${keystorePath}`)
  const envText = fs.readFileSync(envPath, 'utf8')
  storePassword = /ANDROID_KEYSTORE_PASSWORD=(.+)/.exec(envText)?.[1]?.trim()
  keyPassword = /ANDROID_KEY_PASSWORD=(.+)/.exec(envText)?.[1]?.trim() || storePassword
  if (!storePassword) {
    console.error('Existing env file is missing ANDROID_KEYSTORE_PASSWORD. Aborting.')
    process.exit(1)
  }
} else {
  storePassword = randomPassword()
  keyPassword = storePassword
  const keytool = findKeytool()
  if (keytool) {
    console.log(`Generating keystore with ${keytool} …`)
    generateWithKeytool(keytool, storePassword, keyPassword)
  } else {
    console.log('keytool not found; generating PKCS12 via PowerShell New-SelfSignedCertificate …')
    generateWithPowerShell(storePassword)
  }
}

const base64 = fs.readFileSync(keystorePath).toString('base64')
const envBody = [
  `ANDROID_KEYSTORE_BASE64=${base64}`,
  `ANDROID_KEYSTORE_PASSWORD=${storePassword}`,
  `ANDROID_KEY_ALIAS=${alias}`,
  `ANDROID_KEY_PASSWORD=${keyPassword}`,
  '',
].join('\n')
fs.writeFileSync(envPath, envBody, { mode: 0o600 })

console.log('')
console.log('=== Backup these files offline (do NOT commit) ===')
console.log(`Keystore: ${keystorePath}`)
console.log(`Secrets:  ${envPath}`)
console.log('')

function findGh() {
  const which = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', ['gh'], { encoding: 'utf8' })
  if (which.status === 0) {
    const line = which.stdout.split(/\r?\n/).map(s => s.trim()).find(Boolean)
    if (line) return line
  }
  const extra = [
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'GitHub CLI', 'gh.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'GitHub CLI', 'gh.exe'),
  ]
  return extra.find(p => p && fs.existsSync(p)) || null
}

if (setSecrets) {
  const ghBin = findGh()
  if (!ghBin) {
    console.error('GitHub CLI (`gh`) is not installed on this machine.')
    console.error('Keystore is ready. Set secrets manually:')
    console.error('  GitHub → loong27/ArkNote → Settings → Secrets and variables → Actions')
    console.error(`  Copy the four values from: ${envPath}`)
    console.error('Names: ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD')
    process.exit(2)
  }
  const gh = spawnSync(ghBin, ['auth', 'status'], { encoding: 'utf8' })
  if (gh.status !== 0) {
    console.error('`gh` is not authenticated. Run `gh auth login`, then re-run with --set-secrets.')
    console.error(`Or paste values from ${envPath} into GitHub Actions secrets.`)
    process.exit(1)
  }
  const pairs = [
    ['ANDROID_KEYSTORE_BASE64', base64],
    ['ANDROID_KEYSTORE_PASSWORD', storePassword],
    ['ANDROID_KEY_ALIAS', alias],
    ['ANDROID_KEY_PASSWORD', keyPassword],
  ]
  for (const [name, value] of pairs) {
    execFileSync(ghBin, ['secret', 'set', name], {
      input: value,
      stdio: ['pipe', 'inherit', 'inherit'],
    })
    console.log(`Set secret ${name}`)
  }
  console.log('GitHub Actions secrets updated for the current repository.')
} else {
  console.log('To push secrets to GitHub:')
  console.log('  npm run android:keystore -- --set-secrets')
  console.log(`Or paste values from ${envPath} into repository Actions secrets.`)
}
