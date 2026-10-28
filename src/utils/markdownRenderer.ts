import MarkdownIt from 'markdown-it'
import abbr from 'markdown-it-abbr'
import deflist from 'markdown-it-deflist'
import footnote from 'markdown-it-footnote'
import ins from 'markdown-it-ins'
import mark from 'markdown-it-mark'
import sub from 'markdown-it-sub'
import sup from 'markdown-it-sup'
import taskLists from 'markdown-it-task-lists'
import hljs from 'highlight.js'
import { getLanguageLabel, normalizeLanguage } from './codeLanguages'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function highlightCode(str: string, lang: string): string {
  const id = normalizeLanguage(lang)
  if (!id || id === 'plain' || id === 'mermaid') {
    return escapeHtml(str)
  }
  if (hljs.getLanguage(id)) {
    try {
      return hljs.highlight(str, { language: id, ignoreIllegals: true }).value
    } catch {
      // fall through
    }
  }
  return escapeHtml(str)
}

function createMarkdownRenderer(): MarkdownIt {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    breaks: true,
    highlight: highlightCode,
  })

  md
    .use(taskLists, { enabled: true, label: true, labelAfter: true })
    .use(footnote)
    .use(sub)
    .use(sup)
    .use(ins)
    .use(mark)
    .use(abbr)
    .use(deflist)

  md.renderer.rules.table_open = () => '<div class="markdown-table-wrap"><table>\n'
  md.renderer.rules.table_close = () => '</table></div>\n'

  md.renderer.rules.fence = (tokens, idx, options) => {
    const token = tokens[idx]
    const info = token.info ? md.utils.unescapeAll(token.info).trim() : ''
    const lang = normalizeLanguage(info.split(/\s+/)[0] || '')

    // Mermaid: keep bare pre>code.language-mermaid for post-render SVG swap
    if (lang === 'mermaid') {
      const content = escapeHtml(token.content)
      return `<pre><code class="language-mermaid">${content}</code></pre>\n`
    }

    const highlighted = options.highlight
      ? options.highlight(token.content, lang, '')
      : escapeHtml(token.content)

    const langClass = lang && lang !== 'plain' ? ` language-${lang}` : ''
    const dataLang = lang && lang !== 'plain' ? lang : ''
    const codeAttrs = langClass ? ` class="hljs${langClass}"` : ' class="hljs"'
    // Language label is English (programming names). Copy button is injected in preview for i18n.
    const label = escapeHtml(getLanguageLabel(dataLang || 'plain'))

    return (
      `<div class="md-code-block"${dataLang ? ` data-lang="${dataLang}"` : ''}>` +
      `<div class="md-code-header"><span class="md-code-lang">${label}</span></div>` +
      `<pre><code${codeAttrs}>${highlighted}</code></pre>` +
      `</div>\n`
    )
  }

  return md
}

const md = createMarkdownRenderer()

export function renderMarkdown(source: string): string {
  return md.render(source)
}

export { createMarkdownRenderer }
