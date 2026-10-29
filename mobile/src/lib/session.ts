import {
  VaultReader,
  createMemoryFileAccess,
  type VaultNoteMeta,
} from '@shared/vaultRead'

let reader: VaultReader | null = null

export function getReader(): VaultReader {
  if (!reader || !reader.isUnlocked()) {
    throw new Error('vault locked')
  }
  return reader
}

export function hasUnlockedVault(): boolean {
  return Boolean(reader?.isUnlocked())
}

export async function unlockFromFiles(files: Map<string, Uint8Array>, password: string): Promise<void> {
  const next = new VaultReader(createMemoryFileAccess(files))
  await next.unlock(password)
  reader?.lock()
  reader = next
}

export function lockVault(): void {
  reader?.lock()
  reader = null
}

export function listNotes(): VaultNoteMeta[] {
  return getReader().listNotes()
}
