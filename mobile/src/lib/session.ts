import {
  VaultReader,
  createMemoryFileAccess,
  type VaultNoteMeta,
} from '@shared/vaultRead'
import { createCapacitorVaultAccess, vaultExists, writeVaultFiles } from './vaultStore'

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
  await writeVaultFiles(files)
  await unlockFromStore(password)
}

export async function unlockFromStore(password: string): Promise<void> {
  if (!(await vaultExists())) {
    throw new Error('本地还没有仓库，请先导入备份或从 Git 同步')
  }
  const next = new VaultReader(createCapacitorVaultAccess())
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

export { vaultExists, createMemoryFileAccess }
