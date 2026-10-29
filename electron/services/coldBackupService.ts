import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import https from 'https'
import http from 'http'
import { URL } from 'url'
import os from 'os'
import { dialog } from 'electron'
import type { AppConfig, ColdBackupConfigData } from './appConfig'
import type { EncryptionService } from './encryption'
import type { FileManager } from './fileManager'
import { packColdArchive, unpackColdArchive, validateColdVaultDir } from './coldArchive'

export interface ColdBackupActionResult {
  success: boolean
  message: string
  detail?: string
}

const REQUEST_TIMEOUT_MS = 15000

/**
 * S3-compatible encrypted cold backup.
 * Uploads a ciphertext vault archive; credentials stay in local app config only.
 */
export class ColdBackupService {
  private timer: NodeJS.Timeout | null = null
  private restoreInProgress = false

  constructor(
    private appConfig: AppConfig,
    private dataDir: string,
    private encryption: EncryptionService,
    private fileManager: FileManager,
  ) {
    void this.encryption
    void this.fileManager
  }

  getConfig(): ColdBackupConfigData {
    return this.appConfig.getColdBackupConfig()
  }

  setConfig(config: ColdBackupConfigData): ColdBackupConfigData {
    const saved = this.appConfig.setColdBackupConfig(config)
    this.restartScheduler()
    return saved
  }

  startScheduler(): void {
    this.restartScheduler()
  }

  stopScheduler(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private restartScheduler(): void {
    this.stopScheduler()
    const config = this.getConfig()
    if (!config.enabled) return
    const ms = Math.max(1, config.intervalHours) * 60 * 60 * 1000
    this.timer = setInterval(() => {
      void this.runNow().then((result) => {
        if (!result.success) {
          console.error('Cold backup failed:', result.message, result.detail || '')
        }
      })
    }, ms)
  }

  private persistOutcome(partial: Partial<ColdBackupConfigData>): void {
    const config = this.getConfig()
    this.appConfig.setColdBackupConfig({ ...config, ...partial })
  }

  async runNow(): Promise<ColdBackupActionResult> {
    const config = this.getConfig()
    const missing = this.missingConfigMessage(config)
    if (missing) {
      this.persistOutcome({ lastError: missing })
      return { success: false, message: missing }
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arknote-cold-'))
    const archivePath = path.join(tmpDir, `vault-${Date.now()}.bin`)
    try {
      if (!fs.existsSync(this.dataDir)) throw new Error('数据目录不存在')
      const body = packColdArchive(this.dataDir)
      fs.writeFileSync(archivePath, body)
      const key = `${config.prefix.replace(/\/+$/, '')}/vault-${new Date().toISOString().replace(/[:.]/g, '-')}.bin`
      await this.putObject(config, key, body)
      this.persistOutcome({ lastBackupAt: new Date().toISOString(), lastError: null })
      return { success: true, message: `冷备份已上传: ${key}` }
    } catch (error) {
      const mapped = this.mapError(error)
      this.persistOutcome({ lastError: mapped.message })
      return { success: false, message: mapped.message, detail: mapped.detail }
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      } catch {
        // ignore
      }
    }
  }

  async testConnection(): Promise<ColdBackupActionResult> {
    const config = this.getConfig()
    const missing = this.missingConfigMessage(config)
    if (missing) return { success: false, message: missing }

    const key = `${config.prefix.replace(/\/+$/, '')}/.arknote-probe-${Date.now()}.txt`
    const body = Buffer.from(`arknote-probe ${new Date().toISOString()}`, 'utf-8')
    try {
      await this.putObject(config, key, body)
      try {
        await this.deleteObject(config, key)
      } catch (error) {
        const mapped = this.mapError(error)
        return {
          success: true,
          message: '连接成功（写入可用；清理探测对象失败，可忽略）',
          detail: mapped.detail || mapped.message,
        }
      }
      return { success: true, message: '连接成功，凭证与 Bucket 可用' }
    } catch (error) {
      const mapped = this.mapError(error)
      return { success: false, message: mapped.message, detail: mapped.detail }
    }
  }

  async restoreFromFile(): Promise<ColdBackupActionResult> {
    if (this.restoreInProgress) {
      return { success: false, message: '恢复任务正在进行，请稍候' }
    }

    const picked = await dialog.showOpenDialog({
      title: '选择冷备份文件',
      filters: [
        { name: 'arkNote Cold Backup', extensions: ['bin'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    })
    if (picked.canceled || !picked.filePaths[0]) {
      return { success: false, message: '已取消' }
    }

    this.restoreInProgress = true
    let stagingDir = ''
    let restored = false
    try {
      this.assertTargetIsEmpty()
      const body = fs.readFileSync(picked.filePaths[0])
      const parentDir = path.dirname(this.dataDir)
      fs.mkdirSync(parentDir, { recursive: true })
      stagingDir = path.join(
        parentDir,
        `.${path.basename(this.dataDir)}.cold-restore-${process.pid}-${crypto.randomUUID()}`,
      )
      unpackColdArchive(body, stagingDir)
      validateColdVaultDir(stagingDir)
      this.assertTargetIsEmpty()

      if (fs.existsSync(this.dataDir)) {
        fs.rmdirSync(this.dataDir)
      }
      fs.renameSync(stagingDir, this.dataDir)
      restored = true
      return {
        success: true,
        message: '冷备份已恢复到空数据目录，请使用原仓库密码解锁后重启应用',
      }
    } catch (error) {
      const mapped = this.mapError(error)
      return { success: false, message: mapped.message, detail: mapped.detail }
    } finally {
      if (!restored && stagingDir && fs.existsSync(stagingDir)) {
        fs.rmSync(stagingDir, { recursive: true, force: true })
      }
      this.restoreInProgress = false
    }
  }

  private missingConfigMessage(config: ColdBackupConfigData): string | null {
    if (!config.endpoint || !config.bucket || !config.accessKeyId || !config.secretAccessKey) {
      return '请先完整配置冷备份 Endpoint、Bucket 与密钥'
    }
    return null
  }

  private assertTargetIsEmpty(): void {
    if (!fs.existsSync(this.dataDir)) return
    if (!fs.statSync(this.dataDir).isDirectory()) {
      throw new Error('本地数据路径不是目录')
    }
    if (fs.readdirSync(this.dataDir).length > 0) {
      throw new Error('本地数据目录已有内容，已取消恢复以避免覆盖数据')
    }
  }

  private mapError(error: unknown): { message: string; detail?: string } {
    const raw = error instanceof Error ? error.message : String(error)
    const detail = raw.slice(0, 400)
    if (/HTTP 403|SignatureDoesNotMatch|InvalidAccessKeyId|AccessDenied/i.test(raw)) {
      return { message: '鉴权失败：请检查 Access Key、Secret 与 Region', detail }
    }
    if (/HTTP 404|NoSuchBucket/i.test(raw)) {
      return { message: '找不到 Bucket：请确认名称与 Endpoint 是否匹配', detail }
    }
    if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|timeout|network/i.test(raw)) {
      return { message: '无法连接存储服务：请检查 Endpoint 与网络', detail }
    }
    if (/RequestTimeTooSkewed|clock/i.test(raw)) {
      return { message: '本机时间偏差过大，请校正系统时钟后重试', detail }
    }
    if (/已取消恢复|已有内容|缺少有效|不安全路径|过短|损坏|不一致|不支持的冷备份/.test(raw)) {
      return { message: raw, detail }
    }
    return { message: `冷备份失败: ${raw.slice(0, 160)}`, detail }
  }

  private async putObject(config: ColdBackupConfigData, key: string, body: Buffer): Promise<void> {
    await this.signedRequest(config, 'PUT', key, body, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(body.length),
    })
  }

  private async deleteObject(config: ColdBackupConfigData, key: string): Promise<void> {
    await this.signedRequest(config, 'DELETE', key, Buffer.alloc(0), {})
  }

  private async signedRequest(
    config: ColdBackupConfigData,
    method: 'PUT' | 'DELETE',
    key: string,
    body: Buffer,
    extraHeaders: Record<string, string>,
  ): Promise<void> {
    const endpoint = config.endpoint.replace(/\/+$/, '')
    const url = new URL(`${endpoint}/${config.bucket}/${key.split('/').map(encodeURIComponent).join('/')}`)
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
    const dateStamp = amzDate.slice(0, 8)
    const region = config.region || 'us-east-1'
    const service = 's3'
    const payloadHash = crypto.createHash('sha256').update(body).digest('hex')
    const canonicalHeaders = `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date'
    const canonicalRequest = [
      method,
      url.pathname,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n')
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n')
    const signingKey = this.getSignatureKey(config.secretAccessKey, dateStamp, region, service)
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex')
    const authorization =
      `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`

    await new Promise<void>((resolve, reject) => {
      const lib = url.protocol === 'http:' ? http : https
      const req = lib.request({
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || undefined,
        path: url.pathname + url.search,
        method,
        headers: {
          Host: url.host,
          'x-amz-content-sha256': payloadHash,
          'x-amz-date': amzDate,
          Authorization: authorization,
          ...extraHeaders,
        },
      }, (res) => {
        const chunks: Buffer[] = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => {
          if ((res.statusCode || 500) >= 300) {
            reject(new Error(`S3 ${method} 失败 HTTP ${res.statusCode}: ${Buffer.concat(chunks).toString('utf-8').slice(0, 300)}`))
          } else {
            resolve()
          }
        })
      })
      req.setTimeout(REQUEST_TIMEOUT_MS, () => {
        req.destroy(new Error('请求超时'))
      })
      req.on('error', reject)
      if (body.length > 0) req.write(body)
      req.end()
    })
  }

  private getSignatureKey(key: string, dateStamp: string, region: string, service: string): Buffer {
    const kDate = crypto.createHmac('sha256', `AWS4${key}`).update(dateStamp).digest()
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest()
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest()
    return crypto.createHmac('sha256', kService).update('aws4_request').digest()
  }
}
