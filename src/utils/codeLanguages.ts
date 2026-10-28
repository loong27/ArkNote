/** Language aliases → canonical highlight.js / display id */
const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  rb: 'ruby',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  cs: 'csharp',
  'c++': 'cpp',
  'c#': 'csharp',
  golang: 'go',
  rs: 'rust',
  kt: 'kotlin',
  md: 'markdown',
  plaintext: 'plain',
  text: 'plain',
  txt: 'plain',
}

/** Display labels for known languages (toolbar + preview header) */
const LANGUAGE_LABELS: Record<string, string> = {
  plain: 'Plain text',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  java: 'Java',
  csharp: 'C#',
  cpp: 'C++',
  c: 'C',
  go: 'Go',
  rust: 'Rust',
  ruby: 'Ruby',
  php: 'PHP',
  swift: 'Swift',
  kotlin: 'Kotlin',
  bash: 'Bash',
  powershell: 'PowerShell',
  sql: 'SQL',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  json: 'JSON',
  yaml: 'YAML',
  xml: 'XML',
  markdown: 'Markdown',
  dockerfile: 'Dockerfile',
  graphql: 'GraphQL',
  lua: 'Lua',
  r: 'R',
  scala: 'Scala',
  dart: 'Dart',
  mermaid: 'Mermaid',
}

/** Languages shown in the editor toolbar code-block picker */
export const TOOLBAR_CODE_LANGUAGES: { id: string; label: string }[] = [
  { id: 'plain', label: 'Plain text' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'python', label: 'Python' },
  { id: 'java', label: 'Java' },
  { id: 'csharp', label: 'C#' },
  { id: 'cpp', label: 'C++' },
  { id: 'c', label: 'C' },
  { id: 'go', label: 'Go' },
  { id: 'rust', label: 'Rust' },
  { id: 'ruby', label: 'Ruby' },
  { id: 'php', label: 'PHP' },
  { id: 'swift', label: 'Swift' },
  { id: 'kotlin', label: 'Kotlin' },
  { id: 'bash', label: 'Bash' },
  { id: 'powershell', label: 'PowerShell' },
  { id: 'sql', label: 'SQL' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'json', label: 'JSON' },
  { id: 'yaml', label: 'YAML' },
  { id: 'xml', label: 'XML' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'dockerfile', label: 'Dockerfile' },
]

/**
 * Normalize a fence language info string to a canonical id.
 * Returns empty string for missing / plain.
 */
export function normalizeLanguage(raw: string | undefined | null): string {
  if (!raw) return ''
  const cleaned = raw.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
  if (!cleaned || cleaned === 'plain' || cleaned === 'plaintext' || cleaned === 'text' || cleaned === 'txt') {
    return cleaned === 'plain' || cleaned === 'plaintext' || cleaned === 'text' || cleaned === 'txt' ? 'plain' : ''
  }
  return LANGUAGE_ALIASES[cleaned] ?? cleaned
}

/** Human-readable label for a language id (or the id itself). */
export function getLanguageLabel(lang: string): string {
  const id = normalizeLanguage(lang)
  if (!id || id === 'plain') return LANGUAGE_LABELS.plain
  return LANGUAGE_LABELS[id] ?? id
}

/** Fence info attribute for markdown (empty for plain). */
export function fenceLanguageAttr(langId: string): string {
  const id = normalizeLanguage(langId)
  if (!id || id === 'plain') return ''
  return id
}
