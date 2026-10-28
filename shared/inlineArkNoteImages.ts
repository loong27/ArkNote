import { IMAGE_PROTOCOL } from './brand'

const ESCAPED_PROTOCOL = IMAGE_PROTOCOL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function mdImgRegex(): RegExp {
  return new RegExp(`!\\[([^\\]]*)\\]\\(${ESCAPED_PROTOCOL}([^)]+)\\)`, 'g')
}

function htmlImgSrcRegex(): RegExp {
  return new RegExp(
    `(<img\\b[^>]*\\bsrc=["'])${ESCAPED_PROTOCOL}([^"']+)(["'][^>]*>)`,
    'gi',
  )
}

/** True when markdown/HTML text contains any arknote:// image reference. */
export function hasArkNoteImages(content: string): boolean {
  return content.includes(IMAGE_PROTOCOL)
}

/** Collect unique image IDs referenced via arknote:// in markdown or HTML img tags. */
export function collectArkNoteImageIds(content: string): string[] {
  const ids = new Set<string>()

  for (const match of content.matchAll(mdImgRegex())) {
    if (match[2]) ids.add(match[2])
  }

  for (const match of content.matchAll(htmlImgSrcRegex())) {
    if (match[2]) ids.add(match[2])
  }

  return Array.from(ids)
}

/**
 * Replace arknote:// image refs with provided data URLs.
 * Missing IDs in the map are left unchanged.
 */
export function replaceArkNoteImages(
  content: string,
  idToDataUrl: Map<string, string> | Record<string, string>,
): string {
  const lookup = (id: string): string | undefined => {
    if (idToDataUrl instanceof Map) return idToDataUrl.get(id)
    return idToDataUrl[id]
  }

  let result = content.replace(mdImgRegex(), (full, alt, id) => {
    const dataUrl = lookup(id)
    return dataUrl ? `![${alt}](${dataUrl})` : full
  })

  result = result.replace(htmlImgSrcRegex(), (full, prefix, id, suffix) => {
    const dataUrl = lookup(id)
    return dataUrl ? `${prefix}${dataUrl}${suffix}` : full
  })

  return result
}
