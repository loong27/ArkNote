import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 12
const TAG_LENGTH = 16
const SALT_LENGTH = 32
const PBKDF2_ITERATIONS = 600000
const DIGEST = 'sha512'
const VERIFY_TEXT = 'ZZ-NOTE-VERIFY'
const PASSWORD_CHANGE_DIR = '.password-change'

type PasswordChangeManifest = {
  id: string
  state: 'preparing' | 'staging' | 'committing'
  files: string[]
}

export class EncryptionService {
  private key: Buffer | null = null
  private salt: Buffer | null = null
  private dataDir: string
  private passwordChangeInProgress = false

  constructor(dataDir: string) {
    this.dataDir = dataDir
  }

  /**
   * Initialize encryption with user password.
   * On first use, generates salt and stores it.
   * On subsequent uses, reads existing salt.
   */
  async unlock(password: string): Promise<boolean> {
    try {
      this.recoverIncompletePasswordChange()

      const saltPath = path.join(this.dataDir, 'salt.bin')
      const verifyPath = path.join(this.dataDir, 'verify.enc')

      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true })
      }

      let isFirstTime = false

      if (fs.existsSync(saltPath)) {
        // Existing vault - read salt
        this.salt = fs.readFileSync(saltPath)
      } else {
        // New vault - generate salt
        this.salt = crypto.randomBytes(SALT_LENGTH)
        this.writeFileAtomic(saltPath, this.salt)
        isFirstTime = true
      }

      // Derive key from password
      this.key = await this.deriveKey(password, this.salt)

      if (isFirstTime) {
        // Create verification file
        const verifyData = this.encrypt(Buffer.from(VERIFY_TEXT))
        this.writeFileAtomic(verifyPath, verifyData)
        return true
      } else {
        // Verify password by trying to decrypt verification file
        if (!fs.existsSync(verifyPath)) {
          // Fallback: if verify file doesn't exist but salt does, create it
          const verifyData = this.encrypt(Buffer.from(VERIFY_TEXT))
          this.writeFileAtomic(verifyPath, verifyData)
          return true
        }
        try {
          const verifyEnc = fs.readFileSync(verifyPath)
          const decrypted = this.decrypt(verifyEnc)
          return decrypted.toString('utf-8') === VERIFY_TEXT
        } catch {
          this.key = null
          return false
        }
      }
    } catch (error) {
      this.key = null
      throw error
    }
  }

  /**
   * Check if this is first time setup (no salt file)
   */
  isFirstTime(): boolean {
    const saltPath = path.join(this.dataDir, 'salt.bin')
    return !fs.existsSync(saltPath)
  }

  /**
   * Lock the vault - clear the encryption key from memory
   */
  lock(): void {
    if (this.key) {
      this.key.fill(0)
      this.key = null
    }
  }

  /**
   * Check if the vault is locked
   */
  isLocked(): boolean {
    return this.key === null
  }

  /**
   * Change password - re-derive key and update verification
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<boolean> {
    if (this.passwordChangeInProgress || !this.salt || !this.key) return false

    this.passwordChangeInProgress = true
    const originalKey = this.key
    const originalSalt = this.salt

    try {
      this.recoverIncompletePasswordChange()

      // Verify old password
      const oldKey = await this.deriveKey(oldPassword, originalSalt)
      const verifyPath = path.join(this.dataDir, 'verify.enc')
      const verifyEnc = fs.readFileSync(verifyPath)
      const decrypted = this.decryptWithKey(verifyEnc, oldKey)

      if (decrypted.toString('utf-8') !== VERIFY_TEXT) {
        return false
      }

      const newSalt = crypto.randomBytes(SALT_LENGTH)
      const newKey = await this.deriveKey(newPassword, newSalt)

      this.reEncryptAllFilesTransactionally(oldKey, newSalt, newKey)
      this.salt = newSalt
      this.key = newKey

      return true
    } catch (error) {
      try {
        this.recoverIncompletePasswordChange()
      } catch (recoveryError) {
        console.error('Password change recovery failed:', recoveryError)
      }
      this.key = originalKey
      this.salt = originalSalt
      console.error('Password change failed:', error)
      return false
    } finally {
      this.passwordChangeInProgress = false
    }
  }

  /**
   * Encrypt data
   * Format: [IV (12 bytes)][Auth Tag (16 bytes)][Encrypted Data]
   */
  encrypt(data: Buffer): Buffer {
    if (!this.key) throw new Error('Vault is locked')
    return this.encryptWithKey(data, this.key)
  }

  /**
   * Decrypt data
   */
  decrypt(data: Buffer): Buffer {
    if (!this.key) throw new Error('Vault is locked')
    return this.decryptWithKey(data, this.key)
  }

  /**
   * Encrypt string to buffer
   */
  encryptString(text: string): Buffer {
    return this.encrypt(Buffer.from(text, 'utf-8'))
  }

  /**
   * Decrypt buffer to string
   */
  decryptString(data: Buffer): string {
    return this.decrypt(data).toString('utf-8')
  }

  /**
   * Encrypt and write file
   */
  encryptFile(filePath: string, data: Buffer): void {
    const encrypted = this.encrypt(data)
    this.writeFileAtomic(filePath, encrypted)
  }

  /**
   * Read and decrypt file
   */
  decryptFile(filePath: string): Buffer {
    const encrypted = fs.readFileSync(filePath)
    return this.decrypt(encrypted)
  }

  /**
   * Encrypt string and write to file
   */
  encryptStringToFile(filePath: string, text: string): void {
    this.encryptFile(filePath, Buffer.from(text, 'utf-8'))
  }

  /**
   * Read file and decrypt to string
   */
  decryptFileToString(filePath: string): string {
    return this.decryptFile(filePath).toString('utf-8')
  }

  /**
   * Derive encryption key from password and salt using PBKDF2
   */
  private deriveKey(password: string, salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, DIGEST, (err, key) => {
        if (err) reject(err)
        else resolve(key)
      })
    })
  }

  private encryptWithKey(data: Buffer, key: Buffer): Buffer {
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    const encrypted = Buffer.concat([
      cipher.update(data),
      cipher.final(),
    ])

    const tag = cipher.getAuthTag()

    return Buffer.concat([iv, tag, encrypted])
  }

  private decryptWithKey(data: Buffer, key: Buffer): Buffer {
    const iv = data.subarray(0, IV_LENGTH)
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
    const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH)

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)

    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ])
  }

  private reEncryptAllFilesTransactionally(oldKey: Buffer, newSalt: Buffer, newKey: Buffer): void {
    const txnDir = this.passwordChangeDir
    const backupDir = path.join(txnDir, 'backup')
    const stagedDir = path.join(txnDir, 'staged')
    this.removeDirIfExists(txnDir)
    fs.mkdirSync(backupDir, { recursive: true })
    fs.mkdirSync(stagedDir, { recursive: true })

    const files = this.collectEncryptedVaultFiles()
    const manifest: PasswordChangeManifest = {
      id: crypto.randomUUID(),
      state: 'preparing',
      files,
    }

    this.writeManifest(manifest)
    this.backupPasswordChangeFiles(backupDir, files)

    manifest.state = 'staging'
    this.writeManifest(manifest)
    this.stageReEncryptedFiles(stagedDir, files, oldKey, newSalt, newKey)
    this.validateStagedFiles(stagedDir, files, newKey)

    manifest.state = 'committing'
    this.writeManifest(manifest)
    this.commitStagedFiles(stagedDir, files)
    this.removeDirIfExists(txnDir)
  }

  private recoverIncompletePasswordChange(): void {
    const txnDir = this.passwordChangeDir
    const manifestPath = path.join(txnDir, 'manifest.json')
    if (!fs.existsSync(manifestPath)) return

    const backupDir = path.join(txnDir, 'backup')
    if (fs.existsSync(backupDir)) {
      const manifest = this.readManifest(manifestPath)
      const files = manifest?.files ?? this.collectBackupEncryptedFiles(backupDir)
      for (const relPath of files) {
        const backupPath = this.resolveInBase(backupDir, relPath)
        if (fs.existsSync(backupPath)) {
          this.copyFileEnsuringDir(backupPath, this.resolveInDataDir(relPath))
        }
      }

      for (const fileName of ['salt.bin', 'verify.enc']) {
        const backupPath = path.join(backupDir, fileName)
        if (fs.existsSync(backupPath)) {
          this.copyFileEnsuringDir(backupPath, path.join(this.dataDir, fileName))
        }
      }
    }

    this.removeDirIfExists(txnDir)
  }

  private backupPasswordChangeFiles(backupDir: string, files: string[]): void {
    for (const relPath of files) {
      const sourcePath = this.resolveInDataDir(relPath)
      if (fs.existsSync(sourcePath)) {
        this.copyFileEnsuringDir(sourcePath, this.resolveInBase(backupDir, relPath))
      }
    }

    for (const fileName of ['salt.bin', 'verify.enc']) {
      const sourcePath = path.join(this.dataDir, fileName)
      if (fs.existsSync(sourcePath)) {
        this.copyFileEnsuringDir(sourcePath, path.join(backupDir, fileName))
      }
    }
  }

  private stageReEncryptedFiles(stagedDir: string, files: string[], oldKey: Buffer, newSalt: Buffer, newKey: Buffer): void {
    for (const relPath of files) {
      const encrypted = fs.readFileSync(this.resolveInDataDir(relPath))
      const decrypted = this.decryptWithKey(encrypted, oldKey)
      this.writeFileAtomic(this.resolveInBase(stagedDir, relPath), this.encryptWithKey(decrypted, newKey))
    }

    this.writeFileAtomic(path.join(stagedDir, 'salt.bin'), newSalt)
    this.writeFileAtomic(path.join(stagedDir, 'verify.enc'), this.encryptWithKey(Buffer.from(VERIFY_TEXT), newKey))
  }

  private validateStagedFiles(stagedDir: string, files: string[], newKey: Buffer): void {
    const verify = this.decryptWithKey(fs.readFileSync(path.join(stagedDir, 'verify.enc')), newKey)
    if (verify.toString('utf-8') !== VERIFY_TEXT) {
      throw new Error('Staged verification file is invalid')
    }

    for (const relPath of files) {
      this.decryptWithKey(fs.readFileSync(this.resolveInBase(stagedDir, relPath)), newKey)
    }
  }

  private commitStagedFiles(stagedDir: string, files: string[]): void {
    for (const relPath of files) {
      this.copyFileEnsuringDir(this.resolveInBase(stagedDir, relPath), this.resolveInDataDir(relPath))
    }

    for (const fileName of ['salt.bin', 'verify.enc']) {
      this.copyFileEnsuringDir(path.join(stagedDir, fileName), path.join(this.dataDir, fileName))
    }
  }

  private collectEncryptedVaultFiles(): string[] {
    const files: string[] = []
    const metadataPath = path.join(this.dataDir, 'metadata.json.enc')
    if (fs.existsSync(metadataPath)) {
      files.push('metadata.json.enc')
    }

    for (const rootName of ['notes', 'images', 'versions', 'trash']) {
      this.collectEncryptedFilesInDir(path.join(this.dataDir, rootName), files)
    }

    return files.sort()
  }

  private collectBackupEncryptedFiles(backupDir: string): string[] {
    const files: string[] = []
    this.collectEncryptedFilesInDir(backupDir, files, backupDir)
    return files.filter(file => file !== 'verify.enc').sort()
  }

  private collectEncryptedFilesInDir(dirPath: string, files: string[], baseDir = this.dataDir): void {
    if (!fs.existsSync(dirPath)) return

    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === PASSWORD_CHANGE_DIR) continue
        this.collectEncryptedFilesInDir(fullPath, files, baseDir)
      } else if (entry.name.endsWith('.enc')) {
        files.push(this.toRelativeVaultPath(fullPath, baseDir))
      }
    }
  }

  private writeManifest(manifest: PasswordChangeManifest): void {
    this.writeFileAtomic(path.join(this.passwordChangeDir, 'manifest.json'), Buffer.from(JSON.stringify(manifest, null, 2), 'utf-8'))
  }

  private readManifest(manifestPath: string): PasswordChangeManifest | null {
    try {
      return JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as PasswordChangeManifest
    } catch {
      return null
    }
  }

  private writeFileAtomic(filePath: string, data: Buffer): void {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const tempPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${crypto.randomUUID()}.tmp`)
    const fd = fs.openSync(tempPath, 'w')
    try {
      fs.writeFileSync(fd, data)
      fs.fsyncSync(fd)
    } finally {
      fs.closeSync(fd)
    }
    fs.renameSync(tempPath, filePath)
  }

  private copyFileEnsuringDir(src: string, dest: string): void {
    const dir = path.dirname(dest)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const data = fs.readFileSync(src)
    this.writeFileAtomic(dest, data)
  }

  private removeDirIfExists(dir: string): void {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  }

  private resolveInDataDir(relPath: string): string {
    return this.resolveInBase(this.dataDir, relPath)
  }

  private resolveInBase(baseDir: string, relPath: string): string {
    const resolved = path.resolve(baseDir, ...relPath.split('/'))
    const base = path.resolve(baseDir)
    if (resolved !== base && !resolved.startsWith(base + path.sep)) {
      throw new Error(`Invalid vault path: ${relPath}`)
    }
    return resolved
  }

  private toRelativeVaultPath(filePath: string, baseDir = this.dataDir): string {
    return path.relative(baseDir, filePath).split(path.sep).join('/')
  }

  private get passwordChangeDir(): string {
    return path.join(this.dataDir, PASSWORD_CHANGE_DIR)
  }
}
