import { BrowserWindow, nativeImage, type WebContents } from 'electron'
import fs from 'fs'
import {
  SHARE_CARD_WIDTH,
  buildShareDocumentHtml,
  getBrandLogoDataUrl,
} from './shareDocument'

/** Chromium texture soft limit (~16384px). Keep CSS height * DPR under that. */
const DEVICE_SCALE_FACTOR = 2
const CAPTURE_MAX_HEIGHT = Math.floor(16384 / DEVICE_SCALE_FACTOR)
const VIEWPORT_HEIGHT = 900
const IMAGE_WAIT_TIMEOUT_MS = 5000
const CDP_COMMAND_TIMEOUT_MS = 8000
const PAINT_WAIT_TIMEOUT_MS = 2000
const EXPORT_PNG_TIMEOUT_MS = 30000

export interface ShareExportPayload {
  title: string
  bodyHtml: string
  slogan: string
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`))
    }, ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

async function waitForImages(win: BrowserWindow): Promise<void> {
  await withTimeout(
    win.webContents.executeJavaScript(`
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
    `),
    IMAGE_WAIT_TIMEOUT_MS,
    'waitForImages',
  ).catch((err) => {
    console.warn('waitForImages:', err instanceof Error ? err.message : err)
  })
  await new Promise((resolve) => setTimeout(resolve, 200))
}

async function waitForPaint(win: BrowserWindow, timeoutMs = PAINT_WAIT_TIMEOUT_MS): Promise<void> {
  const wc = win.webContents
  await new Promise<void>((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      wc.removeListener('paint', onPaint)
      clearTimeout(timer)
      resolve()
    }
    const onPaint = () => done()
    const timer = setTimeout(done, timeoutMs)
    wc.once('paint', onPaint)
    // Nudge a frame in case paint already happened before we subscribed.
    void wc.executeJavaScript('void document.body?.offsetHeight').catch(() => done())
  })
}

async function measureContentHeight(win: BrowserWindow): Promise<number> {
  const height = await win.webContents.executeJavaScript(`
    (() => {
      const root = document.querySelector('.share-card') || document.body
      return Math.ceil(Math.max(
        root.scrollHeight,
        root.offsetHeight,
        document.documentElement.scrollHeight,
        document.body.scrollHeight
      ))
    })()
  `)
  return Math.max(1, Number(height) || 1)
}

/** Kill scrollbars / overflow that would show up in the screenshot. */
async function prepareForCapture(win: BrowserWindow): Promise<void> {
  await win.webContents.executeJavaScript(`
    (() => {
      const style = document.createElement('style')
      style.textContent = \`
        * { scrollbar-width: none !important; -ms-overflow-style: none !important; }
        *::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
        html, body, .share-card, .share-body { overflow: hidden !important; }
        pre, .md-code-block, .md-code-block pre, .mermaid-container, table {
          overflow: hidden !important;
          overflow-x: hidden !important;
          overflow-y: hidden !important;
          max-width: 100% !important;
        }
      \`
      document.head.appendChild(style)

      for (const el of Array.from(document.querySelectorAll('*'))) {
        const styleDecl = window.getComputedStyle(el)
        if (styleDecl.overflow === 'auto' || styleDecl.overflow === 'scroll'
          || styleDecl.overflowX === 'auto' || styleDecl.overflowX === 'scroll'
          || styleDecl.overflowY === 'auto' || styleDecl.overflowY === 'scroll') {
          el.style.setProperty('overflow', 'hidden', 'important')
          el.style.setProperty('overflow-x', 'hidden', 'important')
          el.style.setProperty('overflow-y', 'hidden', 'important')
        }
      }
    })()
  `)
}

async function stitchPngSlices(
  win: BrowserWindow,
  slices: Buffer[],
  widthPx: number,
  totalHeightPx: number,
): Promise<Buffer> {
  const dataUrls = slices.map((buf) => `data:image/png;base64,${buf.toString('base64')}`)
  const dataUrl: string = await win.webContents.executeJavaScript(`
    (async () => {
      const width = ${widthPx}
      const totalHeight = ${totalHeightPx}
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
}

async function cdpSendCommand(
  wc: WebContents,
  method: string,
  params?: Record<string, unknown>,
): Promise<unknown> {
  return withTimeout(
    wc.debugger.sendCommand(method, params),
    CDP_COMMAND_TIMEOUT_MS,
    `CDP ${method}`,
  )
}

async function captureFullPageCdp(
  win: BrowserWindow,
  width: number,
  contentHeight: number,
): Promise<Buffer> {
  const wc = win.webContents
  try {
    wc.debugger.attach('1.3')
  } catch (err) {
    throw new Error(`CDP debugger attach failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  try {
    await cdpSendCommand(wc, 'Page.enable')
    await cdpSendCommand(wc, 'Emulation.setDeviceMetricsOverride', {
      width,
      height: contentHeight,
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
      mobile: false,
    })

    await new Promise((resolve) => setTimeout(resolve, 150))

    // fromSurface:false avoids hanging on hidden windows with no GPU compositor surface.
    const result = await cdpSendCommand(wc, 'Page.captureScreenshot', {
      format: 'png',
      fromSurface: false,
      captureBeyondViewport: true,
    }) as { data: string }

    if (!result?.data) {
      throw new Error('CDP captureScreenshot returned empty data')
    }

    return Buffer.from(result.data, 'base64')
  } finally {
    try {
      await cdpSendCommand(wc, 'Emulation.clearDeviceMetricsOverride')
    } catch {
      // ignore
    }
    try {
      wc.debugger.detach()
    } catch {
      // ignore
    }
  }
}

async function captureSlicedFallback(
  win: BrowserWindow,
  width: number,
  contentHeight: number,
): Promise<Buffer> {
  // Stable OS-clamped viewport; never ask capturePage for a taller rect than the window.
  win.setContentSize(width, VIEWPORT_HEIGHT)
  await new Promise((resolve) => setTimeout(resolve, 100))

  const [, actualH] = win.getContentSize()
  const viewportH = Math.max(1, actualH)

  // Allow vertical scroll for slicing only (scrollbars still hidden via CSS).
  await win.webContents.executeJavaScript(`
    document.documentElement.style.setProperty('overflow-y', 'auto', 'important')
    document.body.style.setProperty('overflow-y', 'auto', 'important')
  `)

  const slices: Buffer[] = []
  let captured = 0
  while (captured < contentHeight) {
    const sliceH = Math.min(viewportH, contentHeight - captured)
    await win.webContents.executeJavaScript(`window.scrollTo(0, ${captured})`)
    await waitForPaint(win, 300)

    const image = await win.webContents.capturePage()
    const size = image.getSize()
    const scaleY = size.height / viewportH
    const cropH = Math.min(size.height, Math.max(1, Math.round(sliceH * scaleY)))
    const cropped = image.crop({ x: 0, y: 0, width: size.width, height: cropH })
    slices.push(cropped.toPNG())
    captured += sliceH
  }

  if (slices.length === 1) return slices[0]

  const stitchWidth = nativeImage.createFromBuffer(slices[0]).getSize().width
  let stitchHeight = 0
  for (const buf of slices) {
    stitchHeight += nativeImage.createFromBuffer(buf).getSize().height
  }

  return stitchPngSlices(win, slices, stitchWidth, stitchHeight)
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
      paintWhenInitiallyHidden: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        offscreen: true,
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
      await prepareForCapture(win)

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
   * Uses CDP full-page screenshot so OS window height clamps cannot smear the image.
   */
  async exportToPng(payload: ShareExportPayload): Promise<Buffer> {
    return withTimeout(this.exportToPngInner(payload), EXPORT_PNG_TIMEOUT_MS, 'exportToPng')
  }

  private async exportToPngInner(payload: ShareExportPayload): Promise<Buffer> {
    const width = SHARE_CARD_WIDTH
    const win = this.createHiddenWindow(width, VIEWPORT_HEIGHT)

    try {
      const fullHtml = this.buildHtml(payload, width)
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`)
      await waitForPaint(win)
      await waitForImages(win)
      await prepareForCapture(win)

      const contentHeight = await measureContentHeight(win)

      if (contentHeight <= CAPTURE_MAX_HEIGHT) {
        try {
          return await captureFullPageCdp(win, width, contentHeight)
        } catch (err) {
          console.error('CDP full-page capture failed, falling back to slices:', err)
        }
      }

      return await captureSlicedFallback(win, width, contentHeight)
    } finally {
      win.destroy()
    }
  }
}
