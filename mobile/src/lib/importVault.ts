import { unzipSync } from 'fflate'
import { looksLikeVault } from '@shared/vaultRead'

function normalizeVaultPath(name: string): string {
  return name
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/^\/+/, '')
}

/**
 * If zip/folder nests vault under a single root folder, hoist that prefix.
 */
function hoistVaultRoot(files: Map<string, Uint8Array>): Map<string, Uint8Array> {
  if (looksLikeVault(files)) return files

  const keys = [...files.keys()]
  const firstSegs = new Set(
    keys
      .map(k => k.split('/')[0])
      .filter(Boolean),
  )
  if (firstSegs.size !== 1) return files
  const root = [...firstSegs][0]
  const hoisted = new Map<string, Uint8Array>()
  for (const [key, value] of files) {
    if (!key.startsWith(`${root}/`)) continue
    hoisted.set(key.slice(root.length + 1), value)
  }
  return looksLikeVault(hoisted) ? hoisted : files
}

export async function filesFromZip(buffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const unzipped = unzipSync(new Uint8Array(buffer))
  const map = new Map<string, Uint8Array>()
  for (const [name, data] of Object.entries(unzipped)) {
    if (!data || name.endsWith('/')) continue
    map.set(normalizeVaultPath(name), data)
  }
  return hoistVaultRoot(map)
}

export async function filesFromFileList(fileList: FileList | File[]): Promise<Map<string, Uint8Array>> {
  const files = Array.from(fileList)
  if (files.length === 1 && /\.zip$/i.test(files[0].name)) {
    return filesFromZip(await files[0].arrayBuffer())
  }

  const map = new Map<string, Uint8Array>()
  for (const file of files) {
    const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath
      || file.name
    const normalized = normalizeVaultPath(relative)
    map.set(normalized, new Uint8Array(await file.arrayBuffer()))
  }
  return hoistVaultRoot(map)
}

export function validateVaultFiles(files: Map<string, Uint8Array>): void {
  if (!looksLikeVault(files)) {
    throw new Error('未找到有效的 arkNote 仓库（需要 salt.bin / verify.enc / metadata.json.enc）')
  }
}
