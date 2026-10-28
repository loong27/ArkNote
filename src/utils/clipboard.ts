export async function writeClipboardText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to Electron clipboard IPC
  }
  try {
    const result = await window.electronAPI.clipboard.writeText(text)
    return !!result?.success
  } catch (error) {
    console.error('Failed to write clipboard text:', error)
    return false
  }
}
