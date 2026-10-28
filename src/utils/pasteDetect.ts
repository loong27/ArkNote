const MIN_PLAIN_LENGTH = 40

const STRUCTURAL_TAG_RE =
  /<\s*(h[1-6]|p|ul|ol|li|table|thead|tbody|tr|th|td|a|blockquote|pre|hr|img)\b/i

const MARKDOWN_SIGNAL_RE =
  /(?:^|\n)\s{0,3}(?:#{1,6}\s|```|(?:[-*+]|\d+\.)\s|\[[^\]]+\]\([^)]+\))/m

export interface PasteConvertCandidate {
  html: string
  plain: string
}

/**
 * Heuristic: does plain text already look like Markdown the user intentionally copied?
 */
export function looksLikeMarkdown(plain: string): boolean {
  const text = plain.trim()
  if (!text) return false

  const signals = text.match(
    /(?:^|\n)\s{0,3}(?:#{1,6}\s|```|(?:[-*+]|\d+\.)\s|\[[^\]]+\]\([^)]+\))/gm,
  )
  if (!signals || signals.length < 2) {
    // Single strong fence or multiple links still count as markdown-ish
    if (/```[\s\S]+```/.test(text)) return true
    if ((text.match(/\[[^\]]+\]\([^)]+\)/g) || []).length >= 2) return true
    return MARKDOWN_SIGNAL_RE.test(text) && text.length < 200
  }
  return signals.length >= 2
}

/**
 * True when HTML has real structure (headings, lists, links, etc.),
 * not just a single wrapper around plain text.
 */
export function hasRichHtmlStructure(html: string): boolean {
  const trimmed = html.trim()
  if (!trimmed || !STRUCTURAL_TAG_RE.test(trimmed)) return false

  const structuralMatches = trimmed.match(
    /<\s*(h[1-6]|p|ul|ol|li|table|thead|tbody|tr|th|td|a|blockquote|pre|hr|img)\b/gi,
  )
  if (!structuralMatches || structuralMatches.length === 0) return false

  // Single <a> or lone <p> wrapping short text → not worth prompting
  if (structuralMatches.length === 1) {
    const only = structuralMatches[0].toLowerCase()
    if (only.startsWith('<a') || only.startsWith('<p') || only.startsWith('<span')) {
      return false
    }
  }

  return true
}

/**
 * Decide whether to offer one-click HTML → Markdown conversion after paste.
 */
export function shouldOfferPasteConvert(html: string, plain: string): boolean {
  const plainText = (plain || '').trim()
  if (plainText.length < MIN_PLAIN_LENGTH) return false
  if (!html || !html.trim()) return false
  if (!hasRichHtmlStructure(html)) return false
  if (looksLikeMarkdown(plainText)) return false
  return true
}

export function getPasteConvertCandidate(
  clipboardData: DataTransfer | null | undefined,
): PasteConvertCandidate | null {
  if (!clipboardData) return null

  const html = clipboardData.getData('text/html') || ''
  const plain = clipboardData.getData('text/plain') || ''
  if (!shouldOfferPasteConvert(html, plain)) return null
  return { html, plain }
}
