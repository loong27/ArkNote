import { readFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '..')
const outputDirectory = resolve(root, 'website/assets')
const iconSvg = await readFile(resolve(root, 'build/ark-note-icon.svg'))
const iconData = `data:image/svg+xml;base64,${iconSvg.toString('base64')}`

const cover = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f5f7fa"/>
  <rect y="594" width="1200" height="36" fill="#152334"/>

  <image href="${iconData}" x="82" y="78" width="76" height="76"/>
  <text x="178" y="130" fill="#102033" font-family="Arial, sans-serif" font-size="30" font-weight="700">arkNote</text>
  <rect x="84" y="207" width="34" height="3" fill="#d9772b"/>
  <text x="84" y="286" fill="#102033" font-family="Arial, Microsoft YaHei, sans-serif" font-size="66" font-weight="700">你的数字方舟</text>
  <text x="86" y="337" fill="#43556a" font-family="Arial, Microsoft YaHei, sans-serif" font-size="24">本地优先 · 端到端加密 · Git 同步</text>
  <text x="86" y="401" fill="#77869a" font-family="Arial, Microsoft YaHei, sans-serif" font-size="18">让重要知识始终由你掌握</text>

  <rect x="616" y="62" width="520" height="470" rx="8" fill="#ffffff" stroke="#c8d2dd" stroke-width="2"/>
  <rect x="616" y="62" width="520" height="38" rx="8" fill="#f7f9fb"/>
  <rect x="616" y="92" width="520" height="8" fill="#f7f9fb"/>
  <circle cx="638" cy="81" r="5" fill="#f17e59"/>
  <circle cx="655" cy="81" r="5" fill="#e9bd4f"/>
  <circle cx="672" cy="81" r="5" fill="#54b879"/>
  <text x="860" y="86" text-anchor="middle" fill="#64758a" font-family="Arial, sans-serif" font-size="11">arkNote</text>

  <rect x="616" y="100" width="142" height="432" fill="#f1f5f8"/>
  <line x1="758" y1="100" x2="758" y2="532" stroke="#dce5ed"/>
  <rect x="632" y="122" width="110" height="30" rx="5" fill="#ffffff" stroke="#dce5ed"/>
  <text x="644" y="142" fill="#99a5b3" font-family="Microsoft YaHei, Arial, sans-serif" font-size="9">搜索笔记</text>
  <rect x="630" y="165" width="114" height="31" rx="5" fill="#dfeeff"/>
  <text x="641" y="185" fill="#155fc0" font-family="Microsoft YaHei, Arial, sans-serif" font-size="10">全部笔记             28</text>
  <text x="641" y="219" fill="#607083" font-family="Microsoft YaHei, Arial, sans-serif" font-size="10">工作                    9</text>
  <text x="641" y="250" fill="#607083" font-family="Microsoft YaHei, Arial, sans-serif" font-size="10">灵感                   12</text>
  <text x="641" y="292" fill="#96a2b0" font-family="Microsoft YaHei, Arial, sans-serif" font-size="8">最近更新</text>
  <rect x="630" y="304" width="114" height="53" rx="6" fill="#ffffff"/>
  <text x="641" y="326" fill="#4d5e70" font-family="Microsoft YaHei, Arial, sans-serif" font-size="9" font-weight="600">数字方舟设计笔记</text>
  <text x="641" y="344" fill="#9ba6b2" font-family="Microsoft YaHei, Arial, sans-serif" font-size="7">刚刚 · 已加密同步</text>

  <rect x="758" y="100" width="378" height="42" fill="#f8fafb"/>
  <rect x="776" y="110" width="121" height="32" rx="5" fill="#ffffff" stroke="#e2e8ee"/>
  <text x="790" y="130" fill="#32465c" font-family="Microsoft YaHei, Arial, sans-serif" font-size="9">数字方舟设计笔记</text>
  <rect x="758" y="142" width="378" height="38" fill="#ffffff"/>
  <line x1="758" y1="180" x2="1136" y2="180" stroke="#e7edf2"/>
  <text x="780" y="165" fill="#64758a" font-family="Arial, sans-serif" font-size="10">H1   H2   B   I   ↗   ☑</text>
  <line x1="947" y1="180" x2="947" y2="508" stroke="#e7edf2"/>

  <text x="782" y="219" fill="#176fd8" font-family="Consolas, monospace" font-size="11">#</text>
  <text x="797" y="219" fill="#354a5f" font-family="Microsoft YaHei, Arial, sans-serif" font-size="11">数字方舟设计笔记</text>
  <text x="782" y="254" fill="#176fd8" font-family="Consolas, monospace" font-size="10">##</text>
  <text x="805" y="254" fill="#354a5f" font-family="Microsoft YaHei, Arial, sans-serif" font-size="10">为什么选择本地优先</text>
  <text x="782" y="285" fill="#6c7f93" font-family="Microsoft YaHei, Arial, sans-serif" font-size="9">知识不应被平台的生命周期限制。</text>
  <text x="782" y="322" fill="#176fd8" font-family="Consolas, monospace" font-size="9">-</text>
  <text x="796" y="322" fill="#354a5f" font-family="Microsoft YaHei, Arial, sans-serif" font-size="9">本地完整可用</text>
  <text x="782" y="346" fill="#176fd8" font-family="Consolas, monospace" font-size="9">-</text>
  <text x="796" y="346" fill="#354a5f" font-family="Arial, sans-serif" font-size="9">AES-256-GCM</text>
  <text x="782" y="370" fill="#176fd8" font-family="Consolas, monospace" font-size="9">-</text>
  <text x="796" y="370" fill="#354a5f" font-family="Microsoft YaHei, Arial, sans-serif" font-size="9">Git 版本与同步</text>

  <text x="969" y="216" fill="#1e3248" font-family="Microsoft YaHei, Arial, sans-serif" font-size="15" font-weight="700">数字方舟设计笔记</text>
  <text x="969" y="256" fill="#2e4358" font-family="Microsoft YaHei, Arial, sans-serif" font-size="10" font-weight="600">为什么选择本地优先</text>
  <text x="969" y="283" fill="#627386" font-family="Microsoft YaHei, Arial, sans-serif" font-size="8">知识不应被平台的生命周期限制。</text>
  <circle cx="974" cy="316" r="2" fill="#0a9c9a"/>
  <text x="984" y="319" fill="#627386" font-family="Microsoft YaHei, Arial, sans-serif" font-size="8">本地完整可用</text>
  <circle cx="974" cy="341" r="2" fill="#146ee8"/>
  <text x="984" y="344" fill="#627386" font-family="Arial, sans-serif" font-size="8">AES-256-GCM</text>
  <circle cx="974" cy="366" r="2" fill="#d9772b"/>
  <text x="984" y="369" fill="#627386" font-family="Microsoft YaHei, Arial, sans-serif" font-size="8">Git 版本与同步</text>
  <rect x="969" y="402" width="58" height="28" rx="5" fill="#ffffff" stroke="#cbd8e5"/>
  <text x="998" y="420" text-anchor="middle" fill="#36506a" font-family="Microsoft YaHei, Arial, sans-serif" font-size="8">本地</text>
  <path d="M1036 416h25" stroke="#d9772b" stroke-width="2"/>
  <path d="m1057 412 5 4-5 4" fill="none" stroke="#d9772b" stroke-width="2"/>
  <rect x="1070" y="402" width="50" height="28" rx="5" fill="#ffffff" stroke="#cbd8e5"/>
  <text x="1095" y="420" text-anchor="middle" fill="#36506a" font-family="Arial, sans-serif" font-size="8">GitHub</text>
  <rect x="758" y="508" width="378" height="24" fill="#fafbfc"/>
  <text x="1118" y="523" text-anchor="end" fill="#25835b" font-family="Microsoft YaHei, Arial, sans-serif" font-size="8">● 已加密并同步</text>

  <text x="84" y="616" fill="#c8d1dc" font-family="Arial, sans-serif" font-size="12">ARKNOTE · LOCAL-FIRST ENCRYPTED NOTES</text>
</svg>`

await mkdir(outputDirectory, { recursive: true })
await sharp(Buffer.from(cover)).png({ compressionLevel: 9 }).toFile(resolve(outputDirectory, 'og-cover.png'))
console.log('Generated website/assets/og-cover.png (1200x630).')
