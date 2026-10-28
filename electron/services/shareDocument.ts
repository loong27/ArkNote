import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { BRAND_NAME } from '../../shared/brand'

export const SHARE_CARD_WIDTH = 720

export interface ShareDocumentOptions {
  title: string
  bodyHtml: string
  logoDataUrl: string
  slogan: string
  /** Fixed pixel width for long-image capture; PDF can omit (uses max-width). */
  fixedWidth?: number
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Drop a leading H1 so the card title is not duplicated. */
export function stripLeadingH1(html: string): string {
  return html.replace(/^\s*<h1\b[^>]*>[\s\S]*?<\/h1>\s*/i, '')
}

export function resolveBrandLogoPath(): string {
  if (app.isPackaged) {
    const packaged = path.join(process.resourcesPath, 'icons', '128x128.png')
    if (fs.existsSync(packaged)) return packaged
  }

  const publicIcon = path.join(app.getAppPath(), 'public', 'icon.png')
  if (fs.existsSync(publicIcon)) return publicIcon

  return path.join(app.getAppPath(), 'build', 'icons', '128x128.png')
}

export function getBrandLogoDataUrl(): string {
  const logoPath = resolveBrandLogoPath()
  const buf = fs.readFileSync(logoPath)
  const ext = path.extname(logoPath).toLowerCase()
  const mime = ext === '.ico' ? 'image/x-icon' : 'image/png'
  return `data:${mime};base64,${buf.toString('base64')}`
}

const SHARE_STYLES = `
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #f3f1ec;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif;
    font-size: 15px;
    line-height: 1.85;
    color: #2c2c2c;
    -webkit-font-smoothing: antialiased;
  }
  .share-card {
    background: #faf8f5;
    margin: 0 auto;
    padding: 48px 44px 36px;
  }
  .share-title {
    font-size: 28px;
    font-weight: 700;
    line-height: 1.35;
    color: #1a1a1a;
    margin: 0 0 28px;
    letter-spacing: -0.02em;
    word-break: break-word;
  }
  .share-body {
    word-break: break-word;
  }
  .share-body > :first-child { margin-top: 0; }
  .share-body > :last-child { margin-bottom: 0; }
  h1 { font-size: 1.75em; margin: 1.2em 0 0.5em; color: #1a1a1a; border-bottom: 1px solid #e8e4dc; padding-bottom: 0.3em; }
  h2 { font-size: 1.4em; margin: 1.1em 0 0.45em; color: #222; }
  h3 { font-size: 1.2em; margin: 1em 0 0.4em; color: #333; }
  h4, h5, h6 { font-size: 1.05em; margin: 0.9em 0 0.35em; color: #444; }
  p { margin: 0 0 1em; }
  code {
    background: #efece6;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Fira Code', 'Consolas', 'SF Mono', monospace;
    font-size: 0.9em;
  }
  pre {
    background: #efece6;
    padding: 16px;
    border-radius: 8px;
    overflow-x: auto;
    border: 1px solid #e0dcd4;
  }
  pre code { background: none; padding: 0; }
  .md-code-block {
    margin: 1em 0;
    border-radius: 8px;
    border: 1px solid #e0dcd4;
    background: #efece6;
    overflow: hidden;
  }
  .md-code-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    border-bottom: 1px solid #e0dcd4;
    font-size: 12px;
    color: #666;
    font-family: 'Fira Code', 'Consolas', monospace;
  }
  .md-code-copy { display: none !important; }
  .md-code-block pre {
    margin: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  .md-code-block .hljs-keyword,
  .md-code-block .hljs-selector-tag,
  .md-code-block .hljs-subst { color: #7c3aed; }
  .md-code-block .hljs-string,
  .md-code-block .hljs-doctag,
  .md-code-block .hljs-regexp { color: #16a34a; }
  .md-code-block .hljs-comment,
  .md-code-block .hljs-quote { color: #94a3b8; font-style: italic; }
  .md-code-block .hljs-number,
  .md-code-block .hljs-literal { color: #ea580c; }
  .md-code-block .hljs-title,
  .md-code-block .hljs-section,
  .md-code-block .hljs-title.function_ { color: #2563eb; }
  .md-code-block .hljs-type,
  .md-code-block .hljs-class .hljs-title,
  .md-code-block .hljs-title.class_ { color: #ca8a04; }
  .md-code-block .hljs-attr,
  .md-code-block .hljs-attribute,
  .md-code-block .hljs-name { color: #ca8a04; }
  .md-code-block .hljs-built_in,
  .md-code-block .hljs-builtin-name { color: #0891b2; }
  .md-code-block .hljs-meta { color: #94a3b8; }
  .md-code-block .hljs-tag { color: #2563eb; }
  blockquote {
    border-left: 4px solid #c4a574;
    margin: 1em 0;
    padding: 0.5em 1em;
    background: #f3efe8;
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
  th { background: #efece6; font-weight: 600; }
  img { max-width: 100%; height: auto; border-radius: 6px; }
  .mermaid-container { margin: 1.2em 0; overflow-x: auto; }
  .mermaid-container svg { max-width: 100%; height: auto; }
  ul, ol { padding-left: 2em; margin: 0 0 1em; }
  li { margin-bottom: 0.3em; }
  a { color: #3b7ddd; text-decoration: none; }
  hr { border: none; border-top: 1px solid #e5e1d8; margin: 2em 0; }
  .task-list-item { list-style: none; }
  .task-list-item input { margin-right: 0.4em; }
  .arknote-share-footer {
    margin-top: 40px;
    padding-top: 22px;
    border-top: 1px solid #e5e1d8;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .arknote-share-footer img {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    flex-shrink: 0;
  }
  .arknote-share-footer-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .arknote-share-footer-brand {
    font-size: 14px;
    font-weight: 650;
    color: #1a1a1a;
    letter-spacing: -0.01em;
  }
  .arknote-share-footer-slogan {
    font-size: 12px;
    color: #8a857c;
    line-height: 1.4;
  }
`

export function buildShareDocumentHtml(options: ShareDocumentOptions): string {
  const title = escapeHtml(options.title.trim() || BRAND_NAME)
  const body = stripLeadingH1(options.bodyHtml)
  const slogan = escapeHtml(options.slogan)
  const widthStyle = options.fixedWidth
    ? `width:${options.fixedWidth}px;max-width:${options.fixedWidth}px;`
    : 'max-width:800px;'

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${SHARE_STYLES}
  .share-card { ${widthStyle} }
  </style>
</head>
<body>
  <article class="share-card">
    <h1 class="share-title">${title}</h1>
    <div class="share-body">${body}</div>
    <footer class="arknote-share-footer">
      <img src="${options.logoDataUrl}" alt="${escapeHtml(BRAND_NAME)}" />
      <div class="arknote-share-footer-text">
        <span class="arknote-share-footer-brand">${escapeHtml(BRAND_NAME)}</span>
        <span class="arknote-share-footer-slogan">${slogan}</span>
      </div>
    </footer>
  </article>
</body>
</html>`
}
