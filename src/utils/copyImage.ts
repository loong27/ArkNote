/** Rasterize an image (including SVG) to a PNG data URL via canvas. */
export function rasterizeImageToPngDataUrl(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || img.width
        canvas.height = img.naturalHeight || img.height
        if (!canvas.width || !canvas.height) {
          reject(new Error('Invalid image dimensions'))
          return
        }
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas unavailable'))
          return
        }
        ctx.drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

function isSvgDataUrl(dataUrl: string): boolean {
  return /image\/svg\+xml/i.test(dataUrl) || /\.svg(\?|#|$)/i.test(dataUrl)
}

/** Write a data URL to the system clipboard as an image. Handles SVG via PNG rasterization. */
export async function copyImageToClipboard(dataUrl: string): Promise<boolean> {
  const tryWrite = async (url: string) => {
    const result = await window.electronAPI.clipboard.writeImage(url)
    return !!result?.success
  }

  try {
    if (!isSvgDataUrl(dataUrl) && (await tryWrite(dataUrl))) {
      return true
    }
    const pngDataUrl = await rasterizeImageToPngDataUrl(dataUrl)
    return await tryWrite(pngDataUrl)
  } catch (err) {
    console.error('Copy image failed:', err)
    return false
  }
}

/**
 * Copy an arknote image by id, or copy an already-resolved data URL.
 * Non-data-URL strings are treated as image ids and loaded via IPC.
 */
export async function copyArkNoteImageToClipboard(imageIdOrDataUrl: string): Promise<boolean> {
  try {
    const dataUrl = imageIdOrDataUrl.startsWith('data:')
      ? imageIdOrDataUrl
      : await window.electronAPI.images.get(imageIdOrDataUrl)
    if (!dataUrl) return false
    return copyImageToClipboard(dataUrl)
  } catch (err) {
    console.error('Copy arknote image failed:', err)
    return false
  }
}
