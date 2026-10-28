import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import esbuild from 'esbuild'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

const outfile = path.join(root, 'scripts', '.tmp-html-to-markdown.cjs')
await esbuild.build({
  entryPoints: [path.join(root, 'src', 'utils', 'htmlToMarkdown.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  logLevel: 'silent',
  // DOMPurify is browser-oriented; htmlToMarkdown falls back without window.
  external: ['dompurify'],
})

const detectOutfile = path.join(root, 'scripts', '.tmp-paste-detect.cjs')
await esbuild.build({
  entryPoints: [path.join(root, 'src', 'utils', 'pasteDetect.ts')],
  outfile: detectOutfile,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  logLevel: 'silent',
})

try {
  // Provide a stub so require('dompurify') succeeds if the bundle still resolves it
  require.cache[require.resolve('dompurify')] = {
    id: require.resolve('dompurify'),
    filename: require.resolve('dompurify'),
    loaded: true,
    exports: { default: { sanitize: (html) => html }, sanitize: (html) => html },
  }

  const { htmlToMarkdown } = require(outfile)
  const {
    shouldOfferPasteConvert,
    hasRichHtmlStructure,
    looksLikeMarkdown,
  } = require(detectOutfile)

  const articleHtml = `
    <h1>Hello World</h1>
    <p>This is a <strong>sample</strong> article with a
      <a href="https://example.com">link</a>.</p>
    <ul>
      <li>One</li>
      <li>Two</li>
    </ul>
    <table>
      <tr><th>A</th><th>B</th></tr>
      <tr><td>1</td><td>2</td></tr>
    </table>
    <script>alert(1)</script>
  `

  const md = htmlToMarkdown(articleHtml)
  assert.ok(md.includes('# Hello World'), 'should convert h1')
  assert.ok(md.includes('**sample**') || md.includes('sample'), 'should keep emphasis')
  assert.ok(md.includes('[link](https://example.com)'), 'should convert links')
  assert.ok(/[-*]\s+One/.test(md), 'should convert lists')
  assert.ok(md.includes('|'), 'should convert tables via GFM')
  assert.ok(!md.includes('<script'), 'script tags must not appear in markdown')
  assert.ok(!md.includes('alert(1)'), 'script contents must be stripped')

  const dataImgMd = htmlToMarkdown('<p>Pic</p><img src="data:image/png;base64,aaaa" alt="x" />')
  assert.ok(!dataImgMd.includes('data:image'), 'data: images should be skipped')

  const plainArticle =
    'Hello World\nThis is a sample article with a link.\nOne\nTwo\nA B\n1 2'
  assert.equal(
    shouldOfferPasteConvert(articleHtml, plainArticle),
    true,
    'rich article HTML should offer convert',
  )

  const wrapped = '<div><span>Just a short wrapper around plain words here for length padding xx</span></div>'
  assert.equal(hasRichHtmlStructure(wrapped), false, 'pure wrapper should not count as rich')
  assert.equal(
    shouldOfferPasteConvert(wrapped, 'Just a short wrapper around plain words here for length padding xx'),
    false,
    'wrapper-only HTML should not offer convert',
  )

  const shortPlain = 'hi'
  assert.equal(
    shouldOfferPasteConvert('<p>hi</p><ul><li>a</li></ul>', shortPlain),
    false,
    'short paste should not offer convert',
  )

  const mdPlain = '# Title\n\n- item one\n- item two\n\nSee [docs](https://example.com) and [more](https://example.org)'
  assert.equal(looksLikeMarkdown(mdPlain), true, 'markdown plain should be detected')
  assert.equal(
    shouldOfferPasteConvert(articleHtml, mdPlain),
    false,
    'already-markdown paste should not offer convert',
  )

  console.log('html-to-markdown / paste-detect tests passed')
} finally {
  for (const file of [outfile, detectOutfile]) {
    try {
      fs.unlinkSync(file)
    } catch {
      // ignore
    }
  }
}
