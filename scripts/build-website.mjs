import { cp, readFile, rm, writeFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(import.meta.dirname, '..')
const defaultSourceDirectory = resolve(root, 'website')
const defaultOutputDirectory = resolve(root, 'website-dist')
const siteUrlPlaceholder = '__ARKNOTE_SITE_URL__'
const filesWithSiteUrl = ['index.html', 'robots.txt', 'sitemap.xml']

export function normalizeSiteUrl(value) {
  if (!value) {
    throw new Error('Missing site URL. Pass --site-url=https://notes.example.com or set ARKNOTE_SITE_URL.')
  }

  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Site URL must use http or https.')
  }

  url.search = ''
  url.hash = ''
  url.pathname = url.pathname.replace(/\/+$/, '')
  return url.toString().replace(/\/$/, '')
}

export async function buildWebsite({
  siteUrl,
  sourceDirectory = defaultSourceDirectory,
  outputDirectory = defaultOutputDirectory,
} = {}) {
  const normalizedSiteUrl = normalizeSiteUrl(siteUrl)
  const resolvedSource = resolve(sourceDirectory)
  const resolvedOutput = resolve(outputDirectory)

  if (resolvedSource === resolvedOutput) {
    throw new Error('Website source and output directories must be different.')
  }

  await rm(resolvedOutput, { recursive: true, force: true })
  await cp(resolvedSource, resolvedOutput, {
    recursive: true,
    filter(sourcePath) {
      const sourceRelativePath = relative(resolvedSource, sourcePath).replaceAll('\\', '/')
      return sourceRelativePath !== 'package.json'
        && sourceRelativePath !== 'node_modules'
        && !sourceRelativePath.startsWith('node_modules/')
    },
  })

  for (const filename of filesWithSiteUrl) {
    const target = resolve(resolvedOutput, filename)
    const source = await readFile(target, 'utf8')
    const output = source.replaceAll(siteUrlPlaceholder, normalizedSiteUrl)
    if (output.includes(siteUrlPlaceholder)) {
      throw new Error(`Failed to inject site URL into ${filename}.`)
    }
    await writeFile(target, output, 'utf8')
  }

  return { outputDirectory: resolvedOutput, siteUrl: normalizedSiteUrl }
}

function readArgument(name) {
  const direct = process.argv.find((argument) => argument.startsWith(`--${name}=`))
  if (direct) return direct.slice(name.length + 3)

  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const entryPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (entryPath === fileURLToPath(import.meta.url)) {
  try {
    const result = await buildWebsite({
      siteUrl: readArgument('site-url') || process.env.ARKNOTE_SITE_URL,
    })
    console.log(`Built standalone website for ${result.siteUrl}`)
    console.log(`Output: ${result.outputDirectory}`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
