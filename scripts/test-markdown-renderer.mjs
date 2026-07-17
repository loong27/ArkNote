import assert from 'node:assert/strict'
import MarkdownIt from 'markdown-it'
import abbr from 'markdown-it-abbr'
import deflist from 'markdown-it-deflist'
import footnote from 'markdown-it-footnote'
import ins from 'markdown-it-ins'
import mark from 'markdown-it-mark'
import sub from 'markdown-it-sub'
import sup from 'markdown-it-sup'
import taskLists from 'markdown-it-task-lists'

const renderer = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true,
})
  .use(taskLists, { enabled: true, label: true, labelAfter: true })
  .use(footnote)
  .use(sub)
  .use(sup)
  .use(ins)
  .use(mark)
  .use(abbr)
  .use(deflist)

const source = `
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

const html = renderer.render(source)
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
  assert.ok(html.includes(fragment), `Expected rendered Markdown to include ${fragment}`)
}

console.log('Markdown extension render tests passed.')
