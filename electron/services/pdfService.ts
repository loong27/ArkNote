import { BrowserWindow } from 'electron'
import fs from 'fs'

export class PdfService {
  /**
   * Export HTML content to PDF using Electron's built-in printToPDF
   */
  async exportToPdf(htmlContent: string, outputPath: string): Promise<void> {
    // Create a hidden window for PDF generation
    const win = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    })

    try {
      // Wrap content in full HTML document with proper styling
      const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 14px;
      line-height: 1.8;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }
    h1 { font-size: 2em; margin-bottom: 0.5em; color: #1a1a1a; border-bottom: 2px solid #e5e5e5; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; margin-bottom: 0.5em; color: #2a2a2a; }
    h3 { font-size: 1.25em; margin-bottom: 0.5em; color: #3a3a3a; }
    h4, h5, h6 { font-size: 1em; margin-bottom: 0.5em; }
    p { margin-bottom: 1em; }
    code {
      background: #f5f5f5;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Fira Code', 'Consolas', monospace;
      font-size: 0.9em;
    }
    pre {
      background: #f5f5f5;
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
      border: 1px solid #e0e0e0;
    }
    pre code { background: none; padding: 0; }
    blockquote {
      border-left: 4px solid #4a9eff;
      margin: 1em 0;
      padding: 0.5em 1em;
      background: #f8f9fa;
      color: #555;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px 12px;
      text-align: left;
    }
    th { background: #f5f5f5; font-weight: 600; }
    img { max-width: 100%; height: auto; }
    ul, ol { padding-left: 2em; margin-bottom: 1em; }
    li { margin-bottom: 0.3em; }
    a { color: #4a9eff; text-decoration: none; }
    hr { border: none; border-top: 1px solid #e5e5e5; margin: 2em 0; }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`

      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`)

      // Wait for content to render
      await new Promise(resolve => setTimeout(resolve, 500))

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
}
