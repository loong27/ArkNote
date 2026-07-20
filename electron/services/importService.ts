import fs from 'fs'
import path from 'path'
import { FileManager } from './fileManager'
import type { NoteMetadata } from '../../src/types'
import { migrateLegacyBrandReferences } from '../../shared/brand'
import { translate, type AppLanguage } from '../../shared/i18n'

export class ImportService {
  private fileManager: FileManager

  constructor(fileManager: FileManager) {
    this.fileManager = fileManager
  }

  /**
   * Import a Markdown file into a directory
   */
  importMdFile(filePath: string, directoryId: string, language: AppLanguage = 'zh-CN'): NoteMetadata {
    const content = migrateLegacyBrandReferences(fs.readFileSync(filePath, 'utf-8'))
    const fileName = path.basename(filePath, path.extname(filePath))
    const title = fileName || translate(language, '导入的笔记')

    const id = this.fileManager.generateId()
    const now = new Date().toISOString()

    const note: NoteMetadata = {
      id,
      title,
      directoryId,
      tags: [],
      createdAt: now,
      updatedAt: now,
      order: this.fileManager.getMetadata().notes.filter(n => n.directoryId === directoryId).length,
    }

    this.fileManager.addNote(note)

    // Process the markdown content: handle relative image references
    let processedContent = content
    const mdDir = path.dirname(filePath)

    // Find image references and import them
    const imageRegex = /!\[([^\]]*)\]\((?!https?:\/\/|data:|arknote:\/\/)([^)]+)\)/g
    const matches = [...processedContent.matchAll(imageRegex)]

    for (const match of matches) {
      const altText = match[1]
      const imagePath = match[2]
      const absoluteImagePath = path.isAbsolute(imagePath)
        ? imagePath
        : path.resolve(mdDir, imagePath)

      if (fs.existsSync(absoluteImagePath)) {
        try {
          const ext = path.extname(absoluteImagePath)
          const imageData = fs.readFileSync(absoluteImagePath)
          const imageId = this.fileManager.saveImage(imageData, ext)
          processedContent = processedContent.replace(
            match[0],
            `![${altText}](arknote://${imageId})`
          )
        } catch (err) {
          console.error(`Failed to import image ${absoluteImagePath}:`, err)
        }
      }
    }

    // Also handle HTML img tags
    const htmlImgRegex = /<img[^>]+src="(?!https?:\/\/|data:|arknote:\/\/)([^"]+)"[^>]*>/g
    const htmlMatches = [...processedContent.matchAll(htmlImgRegex)]

    for (const match of htmlMatches) {
      const imagePath = match[1]
      const absoluteImagePath = path.isAbsolute(imagePath)
        ? imagePath
        : path.resolve(mdDir, imagePath)

      if (fs.existsSync(absoluteImagePath)) {
        try {
          const ext = path.extname(absoluteImagePath)
          const imageData = fs.readFileSync(absoluteImagePath)
          const imageId = this.fileManager.saveImage(imageData, ext)
          processedContent = processedContent.replace(
            match[1],
            `arknote://${imageId}`
          )
        } catch (err) {
          console.error(`Failed to import HTML image ${absoluteImagePath}:`, err)
        }
      }
    }

    this.fileManager.writeNoteContent(id, processedContent)
    return note
  }

  /**
   * Convert extracted PDF page text to Markdown, preserving formatting heuristically.
   * Detects headings (short standalone lines), bullet lists, numbered lists,
   * and preserves line breaks within structured blocks.
   */
  private convertPageTextToMarkdown(pageText: string): string {
    const lines = pageText.split('\n')
    let md = ''
    let i = 0

    while (i < lines.length) {
      const line = lines[i]
      const trimmed = line.trim()

      // Skip empty lines — output a blank line to separate paragraphs
      if (trimmed === '') {
        if (md.length > 0 && !md.endsWith('\n\n')) {
          md += '\n'
        }
        i++
        continue
      }

      // Detect numbered list items like "1. xxx" "1) xxx" "（1）xxx"
      if (/^(\d+[\.\)）、]|（\d+）)\s/.test(trimmed)) {
        // Convert to markdown numbered list
        const listContent = trimmed.replace(/^(\d+)[\.\)）、]\s*/, '$1. ').replace(/^（(\d+)）\s*/, '$1. ')
        md += listContent + '\n'
        i++
        continue
      }

      // Detect bullet list items like "• xxx" "- xxx" "· xxx" "■ xxx"
      if (/^[•·\-–—■●○◆▸▹►☞➤]\s/.test(trimmed)) {
        const listContent = trimmed.replace(/^[•·\-–—■●○◆▸▹►☞➤]\s*/, '- ')
        md += listContent + '\n'
        i++
        continue
      }

      // Detect potential headings: short lines (≤ 60 chars) followed by an empty line,
      // or lines that are ALL CAPS, or noticeably shorter than surrounding text
      const nextLine = i + 1 < lines.length ? lines[i + 1]?.trim() : ''
      const isShortLine = trimmed.length <= 60
      const nextIsEmpty = nextLine === ''
      const looksLikeHeading = isShortLine && nextIsEmpty &&
        !trimmed.endsWith(',') && !trimmed.endsWith('，') &&
        !trimmed.endsWith(';') && !trimmed.endsWith('；') &&
        !trimmed.endsWith('、')

      if (looksLikeHeading && trimmed.length > 0) {
        // Use ## for detected headings (# is reserved for the title)
        md += `\n## ${trimmed}\n\n`
        i++
        continue
      }

      // Regular text line — preserve as-is with line break
      md += trimmed + '\n'
      i++
    }

    return md
  }

  /**
   * Import a PDF file - convert to MD
   * Uses pdf-parse v2.x (PDFParse class) to extract text and images.
   * Processes each page separately to preserve document structure.
   */
  async importPdfFile(filePath: string, directoryId: string, language: AppLanguage = 'zh-CN'): Promise<NoteMetadata> {
    const fileName = path.basename(filePath, '.pdf')
    const title = fileName || translate(language, '导入的PDF笔记')

    const id = this.fileManager.generateId()
    const now = new Date().toISOString()

    const note: NoteMetadata = {
      id,
      title,
      directoryId,
      tags: [],
      createdAt: now,
      updatedAt: now,
      order: this.fileManager.getMetadata().notes.filter(n => n.directoryId === directoryId).length,
    }

    this.fileManager.addNote(note)

    let markdownContent = `# ${title}\n\n`
    markdownContent += `> ${translate(language, '从 PDF 文件导入: {file}', { file: path.basename(filePath) })}\n\n`

    try {
      const { PDFParse } = require('pdf-parse')
      const pdfBuffer = fs.readFileSync(filePath)
      const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) })

      // Extract text per page to preserve page structure
      const textResult = await parser.getText()
      const totalPages = textResult.total || 0

      // Process per-page text if available
      if (textResult.pages && textResult.pages.length > 0) {
        for (let p = 0; p < textResult.pages.length; p++) {
          const pageData = textResult.pages[p]
          const pageText = pageData.text || ''

          if (!pageText.trim()) continue

          // Add page separator for multi-page documents
          if (totalPages > 1 && p > 0) {
            markdownContent += `\n---\n\n`
          }

          // Try to extract images for this page
          try {
            const imageResult = await parser.getImage({
              imageBuffer: true,
              imageDataUrl: false,
              partial: [pageData.num],
            })
            if (imageResult && imageResult.pages) {
              for (const imgPage of imageResult.pages) {
                if (imgPage.images) {
                  for (const img of imgPage.images) {
                    if (img.data && img.width > 50 && img.height > 50) {
                      try {
                        const imageId = this.fileManager.saveImage(Buffer.from(img.data), '.png')
                        markdownContent += `<img src="arknote://${imageId}" alt="PDF image" width="${Math.min(img.width, 600)}" />\n\n`
                      } catch (imgErr) {
                        console.error('Failed to save PDF image:', imgErr)
                      }
                    }
                  }
                }
              }
            }
          } catch {
            // Image extraction for this page failed — non-critical
          }

          // Convert page text to markdown with formatting heuristics
          markdownContent += this.convertPageTextToMarkdown(pageText)
          markdownContent += '\n'
        }
      } else {
        // Fallback: use the concatenated text
        const text = textResult.text || ''
        markdownContent += this.convertPageTextToMarkdown(text)
      }

      // Add metadata footer
      markdownContent += `\n---\n\n`
      markdownContent += `*${translate(language, 'PDF 信息: {pages} 页', { pages: totalPages || translate(language, '未知') })}*\n`

      try { await parser.destroy() } catch { /* ignore */ }
    } catch (error) {
      console.error('PDF parsing failed:', error)
      markdownContent += `*${translate(language, 'PDF 文本提取失败。错误: {message}', { message: error instanceof Error ? error.message : String(error) })}*\n\n`
      markdownContent += `*${translate(language, '你可以手动将 PDF 内容复制粘贴到此笔记中。')}*\n`
    }

    this.fileManager.writeNoteContent(id, markdownContent)
    return note
  }
}
