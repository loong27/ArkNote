import MarkdownIt from 'markdown-it'
import taskLists from 'markdown-it-task-lists'
import DOMPurify from 'dompurify'

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: true,
}).use(taskLists, { enabled: false, label: true, labelAfter: true })

export function renderReadOnlyMarkdown(source: string): string {
  // Strip local arknote image protocol — mobile import may not include images yet
  const cleaned = source
    .replace(/!\[([^\]]*)\]\(arknote:\/\/[^)]+\)/g, '![image]')
    .replace(/<img[^>]+arknote:\/\/[^>]+>/gi, '')
  const html = md.render(cleaned)
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['target', 'rel', 'class', 'checked', 'disabled'],
  })
}
