import DOMPurify from 'dompurify'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'

function stripScriptsAndStyles(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')
}

function sanitizeHtml(html: string): string {
  const stripped = stripScriptsAndStyles(html)
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return stripped
  }
  return DOMPurify.sanitize(stripped, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
  })
}

function createTurndown(): TurndownService {
  const service = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
    strongDelimiter: '**',
    linkStyle: 'inlined',
  })
  service.use(gfm)

  // Skip huge data: images to avoid bloating notes
  service.addRule('skipDataImages', {
    filter: (node) => {
      if (node.nodeName !== 'IMG') return false
      const src = (node.getAttribute('src') || '').trim()
      return src.startsWith('data:')
    },
    replacement: () => '',
  })

  return service
}

let turndownSingleton: TurndownService | null = null

function getTurndown(): TurndownService {
  if (!turndownSingleton) turndownSingleton = createTurndown()
  return turndownSingleton
}

/** Convert clipboard / article HTML into Markdown suitable for the note editor. */
export function htmlToMarkdown(html: string): string {
  const cleaned = sanitizeHtml(html)
  if (!cleaned.trim()) return ''

  const md = getTurndown().turndown(cleaned)
  return md
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
