import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import esbuild from 'esbuild'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

// Bundle the TypeScript renderer for Node smoke tests
const outfile = path.join(root, 'scripts', '.tmp-markdown-renderer.cjs')
await esbuild.build({
  entryPoints: [path.join(root, 'src', 'utils', 'markdownRenderer.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  logLevel: 'silent',
})

try {
  const { renderMarkdown, createMarkdownRenderer } = require(outfile)

  const extensionSource = `
| A | B |
| --- | --- |
| 1 | 2 |

- [ ] task

Text[^1]

[^1]: Footnote

H~2~O x^2^ ++insert++ ==mark==

Term
: Definition

*[HTML]: Hyper Text Markup Language

HTML
`

  const extensionHtml = renderMarkdown(extensionSource)
  const expectedFragments = [
    '<table>',
    'task-list-item',
    'footnote-ref',
    '<sub>',
    '<sup>',
    '<ins>',
    '<mark>',
    '<dl>',
    '<abbr',
  ]

  for (const fragment of expectedFragments) {
    assert.ok(extensionHtml.includes(fragment), `Expected rendered Markdown to include ${fragment}`)
  }

  const jsHtml = renderMarkdown('```js\nconst x = 1\n```\n')
  assert.ok(jsHtml.includes('md-code-block'), 'JS fence should wrap with md-code-block')
  assert.ok(jsHtml.includes('data-lang="javascript"'), 'js alias should normalize to javascript')
  assert.ok(jsHtml.includes('hljs-keyword') || jsHtml.includes('hljs-'), 'JS fence should contain highlight.js spans')
  assert.ok(!jsHtml.includes('<script'), 'highlighted HTML must not inject raw script tags from fences')

  const mermaidHtml = renderMarkdown('```mermaid\nflowchart TD\n  A-->B\n```\n')
  assert.ok(mermaidHtml.includes('language-mermaid'), 'mermaid fence should keep language-mermaid')
  assert.ok(!mermaidHtml.includes('md-code-block'), 'mermaid must not use md-code-block wrapper')
  assert.ok(!mermaidHtml.includes('hljs-'), 'mermaid must not be highlighted by hljs')

  const unknownHtml = renderMarkdown('```notareallang\nfoo <bar>\n```\n')
  assert.ok(unknownHtml.includes('md-code-block'), 'unknown language still gets wrapper')
  assert.ok(unknownHtml.includes('&lt;bar&gt;'), 'unknown language content must be escaped')
  assert.ok(!unknownHtml.includes('hljs-keyword'), 'unknown language should not get keyword spans')

  const xssHtml = renderMarkdown('```js\n<script>alert(1)</script>\n```\n')
  assert.ok(
    xssHtml.includes('&lt;script&gt;') || !xssHtml.includes('<script>alert'),
    'script tags in fences must be escaped'
  )

  const md = createMarkdownRenderer()
  assert.equal(typeof md.render('hi'), 'string')

  console.log('Markdown extension render tests passed.')
} finally {
  try {
    fs.unlinkSync(outfile)
  } catch {
    // ignore cleanup errors
  }
}
