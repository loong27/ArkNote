import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { dialog } from 'electron'
import type { EncryptionService } from './encryption'
import type { FileManager } from './fileManager'

const execFileAsync = promisify(execFile)

export interface VaultIntegrityIssue {
  path: string
  severity: 'error' | 'warning'
  message: string
}

export interface VaultIntegrityReport {
  ok: boolean
  checkedAt: string
  saltOk: boolean
  verifyOk: boolean
  metadataOk: boolean
  notesChecked: number
  notesOk: number
  imagesChecked: number
  imagesOk: number
  versionsChecked: number
  versionsOk: number
  issues: VaultIntegrityIssue[]
}

export class VaultBackupService {
  constructor(
    private dataDir: string,
    private encryption: EncryptionService,
    private fileManager: FileManager,
  ) {}

  async exportEncryptedArchive(): Promise<{ success: boolean; canceled?: boolean; filePath?: string; message: string }> {
    if (!fs.existsSync(this.dataDir)) {
      return { success: false, message: '数据目录不存在' }
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const result = await dialog.showSaveDialog({
      title: '导出加密仓库备份',
      defaultPath: `arknote-vault-${stamp}.${process.platform === 'win32' ? 'zip' : 'tar.gz'}`,
      filters: process.platform === 'win32'
        ? [{ name: 'ZIP', extensions: ['zip'] }]
        : [{ name: 'Gzip Tar', extensions: ['tar.gz', 'tgz'] }],
    })

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true, message: '已取消' }
    }

    const dest = result.filePath
    try {
      await this.createArchive(dest)
      return { success: true, filePath: dest, message: '加密仓库备份已导出（内容仍为密文）' }
    } catch (error) {
      return {
        success: false,
        message: `导出失败: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  private async createArchive(destPath: string): Promise<void> {
    const parent = path.dirname(this.dataDir)
    const base = path.basename(this.dataDir)

    if (process.platform === 'win32') {
      const psDest = destPath.replace(/'/g, "''")
      const psSrc = path.join(this.dataDir, '*').replace(/'/g, "''")
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath)
      await execFileAsync('powershell.exe', [
        '-NoProfile',
        '-Command',
        `Compress-Archive -Path '${psSrc}' -DestinationPath '${psDest}' -Force`,
      ], { windowsHide: true, maxBuffer: 20 * 1024 * 1024 })
      return
    }

    await execFileAsync('tar', ['-czf', destPath, '-C', parent, base], {
      maxBuffer: 20 * 1024 * 1024,
    })
  }

  verifyIntegrity(sampleLimit = 40): VaultIntegrityReport {
    const issues: VaultIntegrityIssue[] = []
    const checkedAt = new Date().toISOString()

    const saltPath = path.join(this.dataDir, 'salt.bin')
    const verifyPath = path.join(this.dataDir, 'verify.enc')
    const metadataPath = path.join(this.dataDir, 'metadata.json.enc')

    const saltOk = fs.existsSync(saltPath) && fs.statSync(saltPath).size === 32
    if (!saltOk) {
      issues.push({ path: 'salt.bin', severity: 'error', message: '缺少或损坏的 salt.bin' })
    }

    let verifyOk = false
    try {
      if (this.encryption.isLocked()) {
        issues.push({ path: 'verify.enc', severity: 'error', message: '仓库已锁定，无法验证' })
      } else if (!fs.existsSync(verifyPath)) {
        issues.push({ path: 'verify.enc', severity: 'error', message: '缺少 verify.enc' })
      } else {
        this.encryption.decryptFile(verifyPath)
        verifyOk = true
      }
    } catch (error) {
      issues.push({
        path: 'verify.enc',
        severity: 'error',
        message: error instanceof Error ? error.message : String(error),
      })
    }

    let metadataOk = false
    try {
      this.fileManager.clearCache()
      this.fileManager.loadMetadata()
      metadataOk = true
    } catch (error) {
      issues.push({
        path: 'metadata.json.enc',
        severity: 'error',
        message: error instanceof Error ? error.message : String(error),
      })
    }

    let notesChecked = 0
    let notesOk = 0
    let imagesChecked = 0
    let imagesOk = 0
    let versionsChecked = 0
    let versionsOk = 0

    if (metadataOk) {
      const meta = this.fileManager.getMetadata()
      const notes = meta.notes.slice(0, sampleLimit)
      for (const note of notes) {
        notesChecked += 1
        try {
          this.fileManager.readNoteContent(note.id)
          notesOk += 1
        } catch (error) {
          issues.push({
            path: `notes/${note.id}.md.enc`,
            severity: 'error',
            message: `笔记「${note.title}」无法解密: ${error instanceof Error ? error.message : String(error)}`,
          })
        }
      }

      const imagesDir = path.join(this.dataDir, 'images')
      if (fs.existsSync(imagesDir)) {
        const imageFiles = fs.readdirSync(imagesDir).filter(f => f.endsWith('.enc')).slice(0, sampleLimit)
        for (const file of imageFiles) {
          imagesChecked += 1
          try {
            this.encryption.decryptFile(path.join(imagesDir, file))
            imagesOk += 1
          } catch (error) {
            issues.push({
              path: `images/${file}`,
              severity: 'error',
              message: error instanceof Error ? error.message : String(error),
            })
          }
        }
      }

      const versionsDir = path.join(this.dataDir, 'versions')
      if (fs.existsSync(versionsDir)) {
        const noteDirs = fs.readdirSync(versionsDir, { withFileTypes: true })
          .filter(d => d.isDirectory())
          .slice(0, Math.ceil(sampleLimit / 2))
        for (const dir of noteDirs) {
          const files = fs.readdirSync(path.join(versionsDir, dir.name))
            .filter(f => f.endsWith('.md.enc'))
            .slice(0, 2)
          for (const file of files) {
            versionsChecked += 1
            try {
              this.encryption.decryptFileToString(path.join(versionsDir, dir.name, file))
              versionsOk += 1
            } catch (error) {
              issues.push({
                path: `versions/${dir.name}/${file}`,
                severity: 'warning',
                message: error instanceof Error ? error.message : String(error),
              })
            }
          }
        }
      }

      if (!fs.existsSync(metadataPath)) {
        metadataOk = false
        issues.push({ path: 'metadata.json.enc', severity: 'error', message: '缺少 metadata.json.enc' })
      }
    }

    const hasErrors = issues.some(i => i.severity === 'error')
    return {
      ok: saltOk && verifyOk && metadataOk && !hasErrors,
      checkedAt,
      saltOk,
      verifyOk,
      metadataOk,
      notesChecked,
      notesOk,
      imagesChecked,
      imagesOk,
      versionsChecked,
      versionsOk,
      issues,
    }
  }
}
