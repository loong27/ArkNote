#!/usr/bin/env node
/**
 * Read-only vault CLI — thin wrapper over shared/vaultRead.ts
 * Password: ARKNOTE_PASSWORD env. Never writes to the vault.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline/promises'
import { build } from 'esbuild'

const require = createRequire(import.meta.url)
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const bundlePath = path.join(os.tmpdir(), `arknote-vault-read-${process.pid}.cjs`)

await build({
  entryPoints: [path.join(projectRoot, 'shared', 'vaultRead.ts')],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  outfile: bundlePath,
})

const { VaultReader } = require(bundlePath)

function parseArgs(argv) {
  const args = { cmd: argv[2] || 'help', dir: '', query: '', noteId: '' }
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--dir') args.dir = argv[++i]
    else if (argv[i] === 'list' || argv[i] === 'search' || argv[i] === 'show' || argv[i] === 'help') args.cmd = argv[i]
    else if (args.cmd === 'search' && !args.query && !argv[i].startsWith('-')) args.query = argv[i]
    else if (args.cmd === 'show' && !args.noteId && !argv[i].startsWith('-')) args.noteId = argv[i]
  }
  if (!args.dir) args.dir = path.join(os.homedir(), '.ark-note')
  return args
}

function createFsAccess(dataDir) {
  return {
    async readBinary(relativePath) {
      const full = path.join(dataDir, relativePath)
      return new Uint8Array(fs.readFileSync(full))
    },
    async listNames(relativePath) {
      const full = path.join(dataDir, relativePath)
      if (!fs.existsSync(full)) return []
      return fs.readdirSync(full)
    },
  }
}

async function promptPassword() {
  if (process.env.ARKNOTE_PASSWORD) return process.env.ARKNOTE_PASSWORD
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const password = await rl.question('Password: ')
  rl.close()
  return password
}

async function main() {
  const args = parseArgs(process.argv)
  if (args.cmd === 'help' || !args.cmd) {
    console.log(`Usage:
  node reader/vault-reader.mjs list --dir <vault>
  node reader/vault-reader.mjs search <query> --dir <vault>
  node reader/vault-reader.mjs show <note-id> --dir <vault>
Env: ARKNOTE_PASSWORD`)
    return
  }

  if (!fs.existsSync(args.dir)) {
    throw new Error(`Vault not found: ${args.dir}`)
  }

  const reader = new VaultReader(createFsAccess(args.dir))
  const password = await promptPassword()
  await reader.unlock(password)

  if (args.cmd === 'list') {
    for (const note of reader.listNotes()) {
      console.log(`${note.id}\t${note.title}`)
    }
    return
  }

  if (args.cmd === 'search') {
    const hits = await reader.search(args.query)
    for (const hit of hits) {
      console.log(`${hit.noteId}\t${hit.title}\t${hit.snippet}`)
    }
    return
  }

  if (args.cmd === 'show') {
    if (!args.noteId) throw new Error('missing note id')
    process.stdout.write(await reader.getNoteContent(args.noteId))
    return
  }

  throw new Error(`unknown command: ${args.cmd}`)
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => {
    try { fs.unlinkSync(bundlePath) } catch { /* ignore */ }
  })
