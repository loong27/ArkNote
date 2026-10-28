import { BrowserWindow } from 'electron'
import fs from 'fs'
import {
  SHARE_CARD_WIDTH,
  buildShareDocumentHtml,
  getBrandLogoDataUrl,
} from './shareDocument'

const CAPTURE_MAX_HEIGHT = 16000
const SLICE_HEIGHT = 4000

export interface ShareExportPayload {
  title: string
  bodyHtml: string
  slogan: string
}

async function waitForImages(win: BrowserWindow): Promise<void> {
  await win.webContents.executeJavaScript(`
    (async () => {
      const imgs = Array.from(document.images || [])
      await Promise.all(imgs.map((img) => {
        if (img.complete) return Promise.resolve()
        return new Promise((resolve) => {
          img.addEventListener('load', resolve, { once: true })
          img.addEventListener('error', resolve, { once: true })
        })
      }))
    })()
  `)
  await new Promise((resolve) => setTimeout(resolve, 200))
}

async function measureContentHeight(win: BrowserWindow): Promise<number> {
  const height = await win.webContents.executeJavaScript(`
    (() => {
      const root = document.querySelector('.share-card') || document.body
      return Math.ceil(Math.max(
        root.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.scrollHeight
      ))
    })()
  `)
  return Math.max(1, Number(height) || 1)
}

async function stitchPngSlices(slices: Buffer[], width: number, totalHeight: number): Promise<Buffer> {
  const dataUrls = slices.map((buf) => `data:image/png;base64,${buf.toString('base64')}`)
  const stitchWin = new BrowserWindow({
    width: Math.min(width, 1200),
    height: 200,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  try {
    await stitchWin.loadURL('data:text/html,<html><body></body></html>')
    const dataUrl: string = await stitchWin.webContents.executeJavaScript(`
      (async () => {
        const width = ${width}
        const totalHeight = ${totalHeight}
        const dataUrls = ${JSON.stringify(dataUrls)}
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = totalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas unavailable')
        let y = 0
        for (const url of dataUrls) {
          const img = new Image()
          img.src = url
          await new Promise((resolve, reject) => {
            img.onload = resolve
            img.onerror = () => reject(new Error('Failed to load slice'))
          })
          ctx.drawImage(img, 0, y)
          y += img.naturalHeight || img.height
        }
        return canvas.toDataURL('image/png')
      })()
    `)
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
    return Buffer.from(base64, 'base64')
  } finally {
    stitchWin.destroy()
  }
}

export class PdfService {
  private buildHtml(payload: ShareExportPayload, fixedWidth?: number): string {
    return buildShareDocumentHtml({
      title: payload.title,
      bodyHtml: payload.bodyHtml,
      logoDataUrl: getBrandLogoDataUrl(),
      slogan: payload.slogan,
      fixedWidth,
    })
  }

  private createHiddenWindow(width: number, height: number): BrowserWindow {
    return new BrowserWindow({
      width,
      height,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    })
  }

  /**
   * Export HTML content to PDF using Electron's built-in printToPDF
   */
  async exportToPdf(payload: ShareExportPayload, outputPath: string): Promise<void> {
    const win = this.createHiddenWindow(800, 600)

    try {
      const fullHtml = this.buildHtml(payload)
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`)
      await waitForImages(win)

      const pdfData = await win.webContents.printToPDF({
        printBackground: true,
        margins: {
          marginType: 'custom',
          top: 0.5,
          bottom: 0.5,
          left: 0.5,
          right: 0.5,
        },
      })

      fs.writeFileSync(outputPath, pdfData)
    } finally {
      win.destroy()
    }
  }

  /**
   * Render a long PNG image of the share card. Returns PNG buffer.
   */
  async exportToPng(payload: ShareExportPayload): Promise<Buffer> {
    const width = SHARE_CARD_WIDTH
    const win = this.createHiddenWindow(width, 900)

    try {
      const fullHtml = this.buildHtml(payload, width)
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`)
      await waitForImages(win)

      const contentHeight = await measureContentHeight(win)

      // Single capture when within Chromium texture limits
      if (contentHeight <= CAPTURE_MAX_HEIGHT) {
        win.setContentSize(width, contentHeight)
        await new Promise((resolve) => setTimeout(resolve, 120))
        try {
          const image = await win.webContents.capturePage({
            x: 0,
            y: 0,
            width,
            height: contentHeight,
          })
          const png = image.toPNG()
          if (png.length > 0) return png
        } catch {
          // Fall through to sliced capture
        }
      }

      // Slice + stitch for very tall documents (or if single capture failed)
      const viewportH = Math.min(SLICE_HEIGHT, contentHeight)
      win.setContentSize(width, viewportH)
      await new Promise((resolve) => setTimeout(resolve, 80))

      const slices: Buffer[] = []
      let captured = 0
      while (captured < contentHeight) {
        const sliceH = Math.min(viewportH, contentHeight - captured)
        await win.webContents.executeJavaScript(`window.scrollTo(0, ${captured})`)
        await new Promise((resolve) => setTimeout(resolve, 80))
        const image = await win.webContents.capturePage({
          x: 0,
          y: 0,
          width,
          height: sliceH,
        })
        slices.push(image.toPNG())
        captured += sliceH
      }

      if (slices.length === 1) return slices[0]
      return stitchPngSlices(slices, width, contentHeight)
    } finally {
      win.destroy()
    }
  }
}
