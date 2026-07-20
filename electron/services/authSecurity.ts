import crypto from 'crypto'
import path from 'path'

export const MIN_NEW_PASSWORD_LENGTH = 12
export const MAX_PASSWORD_BYTES = 1024

const FAILURE_RESET_MS = 24 * 60 * 60 * 1000
const DELAY_AFTER_FAILURES = 3
const BASE_DELAY_MS = 1000
const MAX_DELAY_MS = 5 * 60 * 1000
const MAX_JITTER_MS = 250

const COMMON_PASSWORDS = new Set([
  '123456789012',
  '111111111111',
  'password1234',
  'password12345',
  'qwertyuiop12',
  'qwerty123456',
  'administrator',
  'letmein123456',
  'iloveyou1234',
  'arknote123456',
])

export interface AuthThrottleState {
  failedAttempts: number
  nextAllowedAt: number
  lastFailureAt: number
}

export interface AuthThrottleStore {
  getAuthThrottle(key: string): AuthThrottleState | null
  setAuthThrottle(key: string, state: AuthThrottleState): void
  clearAuthThrottle(key: string): void
}

export interface AuthThrottleStatus {
  failedAttempts: number
  retryAfterMs: number
}

export interface PasswordValidationResult {
  valid: boolean
  message: string
}

export function createVaultAuthKey(dataDir: string): string {
  return crypto.createHash('sha256').update(path.resolve(dataDir)).digest('hex')
}

export function validatePasswordInput(password: unknown): PasswordValidationResult {
  if (typeof password !== 'string' || password.length === 0) {
    return { valid: false, message: '请输入密码' }
  }

  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    return { valid: false, message: '密码长度超出允许范围' }
  }

  return { valid: true, message: '' }
}

export function validateNewPassword(password: unknown): PasswordValidationResult {
  const input = validatePasswordInput(password)
  if (!input.valid || typeof password !== 'string') return input

  const characters = Array.from(password)
  if (characters.length < MIN_NEW_PASSWORD_LENGTH) {
    return { valid: false, message: `密码至少需要 ${MIN_NEW_PASSWORD_LENGTH} 个字符` }
  }

  const normalized = password.normalize('NFKC').toLowerCase().replace(/\s+/g, '')
  if (COMMON_PASSWORDS.has(normalized)) {
    return { valid: false, message: '该密码过于常见，请使用更长的随机密码或多个单词组成的口令' }
  }

  if (/^(.)\1+$/u.test(normalized) || /^\d+$/u.test(normalized)) {
    return { valid: false, message: '密码不能只包含重复字符或数字' }
  }

  const categories = [
    /\p{Ll}/u.test(password) || /\p{Lo}/u.test(password),
    /\p{Lu}/u.test(password),
    /\p{N}/u.test(password),
    /[^\p{L}\p{N}\s]/u.test(password),
  ].filter(Boolean).length

  if (characters.length < 16 && categories < 2) {
    return { valid: false, message: '少于 16 个字符的密码需要包含至少两类字符' }
  }

  return { valid: true, message: '' }
}

export class AuthAttemptLimiter {
  private operationQueue: Promise<void> = Promise.resolve()

  constructor(
    private readonly vaultKey: string,
    private readonly store: AuthThrottleStore,
    private readonly now: () => number = Date.now,
    private readonly random: () => number = Math.random,
  ) {}

  async runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.operationQueue
    let release!: () => void
    this.operationQueue = new Promise<void>((resolve) => {
      release = resolve
    })

    await previous
    try {
      return await operation()
    } finally {
      release()
    }
  }

  getStatus(): AuthThrottleStatus {
    const state = this.getCurrentState()
    return {
      failedAttempts: state.failedAttempts,
      retryAfterMs: Math.max(0, state.nextAllowedAt - this.now()),
    }
  }

  recordFailure(): AuthThrottleStatus {
    const current = this.getCurrentState()
    const failedAttempts = current.failedAttempts + 1
    const exponentialStep = Math.max(0, failedAttempts - DELAY_AFTER_FAILURES)
    const baseDelay = failedAttempts >= DELAY_AFTER_FAILURES
      ? Math.min(MAX_DELAY_MS, BASE_DELAY_MS * (2 ** exponentialStep))
      : 0
    const jitterRange = Math.min(MAX_JITTER_MS, Math.max(0, MAX_DELAY_MS - baseDelay))
    const jitter = baseDelay > 0 ? Math.floor(this.random() * jitterRange) : 0
    const now = this.now()
    const nextAllowedAt = now + baseDelay + jitter

    this.store.setAuthThrottle(this.vaultKey, {
      failedAttempts,
      nextAllowedAt,
      lastFailureAt: now,
    })

    return { failedAttempts, retryAfterMs: baseDelay + jitter }
  }

  reset(): void {
    this.store.clearAuthThrottle(this.vaultKey)
  }

  private getCurrentState(): AuthThrottleState {
    const state = this.store.getAuthThrottle(this.vaultKey)
    if (!state) return { failedAttempts: 0, nextAllowedAt: 0, lastFailureAt: 0 }

    if (this.now() - state.lastFailureAt >= FAILURE_RESET_MS) {
      this.store.clearAuthThrottle(this.vaultKey)
      return { failedAttempts: 0, nextAllowedAt: 0, lastFailureAt: 0 }
    }

    return state
  }
}
