/**
 * Cross-runtime vault crypto (Node 20+ Web Crypto / browser / Capacitor WebView).
 * Format matches electron EncryptionService: [IV 12][Tag 16][Ciphertext]
 */

export const VAULT_CRYPTO = {
  algorithm: 'AES-GCM',
  keyLength: 32,
  ivLength: 12,
  tagLength: 16,
  saltLength: 32,
  pbkdf2Iterations: 600_000,
  hash: 'SHA-512',
  verifyText: 'ARK-NOTE-VERIFY',
  legacyVerifyText: 'YZ-NOTE-VERIFY',
} as const

function getSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    throw new Error('Web Crypto API unavailable')
  }
  return subtle
}

export function toUint8Array(data: ArrayBuffer | Uint8Array): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data)
}

export async function deriveKeyBytes(password: string, salt: Uint8Array): Promise<Uint8Array> {
  if (salt.byteLength !== VAULT_CRYPTO.saltLength) {
    throw new Error('invalid salt.bin')
  }
  const subtle = getSubtle()
  const baseKey = await subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: VAULT_CRYPTO.pbkdf2Iterations,
      hash: VAULT_CRYPTO.hash,
    },
    baseKey,
    VAULT_CRYPTO.keyLength * 8,
  )
  return new Uint8Array(bits)
}

/**
 * Decrypt arkNote AES-256-GCM blob.
 * On-disk layout: IV || AuthTag || Ciphertext
 * Web Crypto expects: Ciphertext || AuthTag
 */
export async function decryptVaultBlob(encrypted: Uint8Array, keyBytes: Uint8Array): Promise<Uint8Array> {
  if (encrypted.byteLength < VAULT_CRYPTO.ivLength + VAULT_CRYPTO.tagLength + 1) {
    throw new Error('encrypted blob too short')
  }
  const iv = encrypted.subarray(0, VAULT_CRYPTO.ivLength)
  const tag = encrypted.subarray(VAULT_CRYPTO.ivLength, VAULT_CRYPTO.ivLength + VAULT_CRYPTO.tagLength)
  const ciphertext = encrypted.subarray(VAULT_CRYPTO.ivLength + VAULT_CRYPTO.tagLength)
  const combined = new Uint8Array(ciphertext.byteLength + tag.byteLength)
  combined.set(ciphertext, 0)
  combined.set(tag, ciphertext.byteLength)

  const subtle = getSubtle()
  const key = await subtle.importKey('raw', keyBytes as BufferSource, { name: 'AES-GCM' }, false, ['decrypt'])
  const plain = await subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    combined as BufferSource,
  )
  return new Uint8Array(plain)
}

export async function decryptVaultUtf8(encrypted: Uint8Array, keyBytes: Uint8Array): Promise<string> {
  const plain = await decryptVaultBlob(encrypted, keyBytes)
  return new TextDecoder().decode(plain)
}

export function isSupportedVerifyText(value: string): boolean {
  return value === VAULT_CRYPTO.verifyText || value === VAULT_CRYPTO.legacyVerifyText
}
