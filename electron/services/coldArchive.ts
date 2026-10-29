import fs from 'fs'
import path from 'path'

export const COLD_ARCHIVE_FORMAT = 'arknote-cold-v1'

export interface ColdArchiveManifest {
  format: string
  createdAt: string
  files: string[]
}

/** Pack a vault directory into the arknote-cold-v1 binary blob (ciphertext files only). */
export function packColdArchive(srcDir: string): Buffer {
  if (!fs.existsSync(srcDir)) throw new Error('数据目录不存在')
  const entries: Array<{ rel: string; abs: string }> = []
  const walk = (dir: string, relBase: string) => {
    for (const name of fs.readdirSync(dir)) {
      if (name === '.git') continue
      const abs = path.join(dir, name)
      const rel = relBase ? `${relBase}/${name}` : name
      const st = fs.statSync(abs)
      if (st.isSymbolicLink()) continue
      if (st.isDirectory()) walk(abs, rel)
      else entries.push({ rel: rel.replace(/\\/g, '/'), abs })
    }
  }
  walk(srcDir, '')

  const chunks: Buffer[] = []
  const manifest = JSON.stringify({
    format: COLD_ARCHIVE_FORMAT,
    createdAt: new Date().toISOString(),
    files: entries.map(e => e.rel),
  } satisfies ColdArchiveManifest)
  const manifestBuf = Buffer.from(manifest, 'utf-8')
  const header = Buffer.alloc(8)
  header.writeUInt32BE(manifestBuf.length, 0)
  header.writeUInt32BE(entries.length, 4)
  chunks.push(header, manifestBuf)

  for (const entry of entries) {
    const data = fs.readFileSync(entry.abs)
    const nameBuf = Buffer.from(entry.rel, 'utf-8')
    const meta = Buffer.alloc(8)
    meta.writeUInt32BE(nameBuf.length, 0)
    meta.writeUInt32BE(data.length, 4)
    chunks.push(meta, nameBuf, data)
  }

  return Buffer.concat(chunks)
}

/** Unpack an arknote-cold-v1 blob into destDir. Returns relative file paths. */
export function unpackColdArchive(body: Buffer, destDir: string): string[] {
  if (body.length < 8) throw new Error('冷备份文件过短或已损坏')
  const manifestLen = body.readUInt32BE(0)
  const fileCount = body.readUInt32BE(4)
  if (manifestLen <= 0 || manifestLen > body.length - 8) {
    throw new Error('冷备份清单长度无效')
  }
  const manifestRaw = body.subarray(8, 8 + manifestLen).toString('utf-8')
  let manifest: ColdArchiveManifest
  try {
    manifest = JSON.parse(manifestRaw) as ColdArchiveManifest
  } catch {
    throw new Error('冷备份清单无法解析')
  }
  if (manifest.format !== COLD_ARCHIVE_FORMAT) {
    throw new Error(`不支持的冷备份格式: ${manifest.format || 'unknown'}`)
  }
  if (!Array.isArray(manifest.files) || manifest.files.length !== fileCount) {
    throw new Error('冷备份文件列表与清单不一致')
  }

  fs.mkdirSync(destDir, { recursive: true })
  let offset = 8 + manifestLen
  const written: string[] = []

  for (let i = 0; i < fileCount; i++) {
    if (offset + 8 > body.length) throw new Error('冷备份在读取文件头时截断')
    const nameLen = body.readUInt32BE(offset)
    const dataLen = body.readUInt32BE(offset + 4)
    offset += 8
    if (nameLen <= 0 || offset + nameLen + dataLen > body.length) {
      throw new Error('冷备份文件条目已损坏')
    }
    const rel = body.subarray(offset, offset + nameLen).toString('utf-8')
    offset += nameLen
    const data = body.subarray(offset, offset + dataLen)
    offset += dataLen

    if (!rel || rel.includes('..') || path.isAbsolute(rel) || rel.startsWith('/') || rel.includes('\\')) {
      throw new Error(`冷备份包含不安全路径: ${rel}`)
    }
    const abs = path.join(destDir, rel)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, data)
    written.push(rel)
  }

  return written
}

export function validateColdVaultDir(dir: string): void {
  const saltPath = path.join(dir, 'salt.bin')
  const verifyPath = path.join(dir, 'verify.enc')
  const metadataPath = path.join(dir, 'metadata.json.enc')
  if (!fs.existsSync(saltPath) || fs.statSync(saltPath).size !== 32) {
    throw new Error('冷备份缺少有效的 salt.bin')
  }
  if (!fs.existsSync(verifyPath) || fs.statSync(verifyPath).size < 29) {
    throw new Error('冷备份缺少有效的 verify.enc')
  }
  if (!fs.existsSync(metadataPath) || fs.statSync(metadataPath).size < 29) {
    throw new Error('冷备份缺少有效的 metadata.json.enc')
  }
}
