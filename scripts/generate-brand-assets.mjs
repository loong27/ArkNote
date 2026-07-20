import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const appIconSource = path.join(projectRoot, 'build', 'ark-note-icon.svg')
const avatarSource = path.join(projectRoot, 'build', 'ark-note-avatar.svg')
const iconSizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
const icoSizes = [16, 24, 32, 48, 64, 128, 256]

async function renderPng(source, size) {
  return sharp(source, { density: 384 })
    .resize(size, size, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
    .toBuffer()
}

function createIco(images) {
  const headerSize = 6
  const directorySize = images.length * 16
  let imageOffset = headerSize + directorySize
  const header = Buffer.alloc(headerSize)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)

  const directory = Buffer.alloc(directorySize)
  for (const [index, image] of images.entries()) {
    const offset = index * 16
    directory[offset] = image.size === 256 ? 0 : image.size
    directory[offset + 1] = image.size === 256 ? 0 : image.size
    directory[offset + 2] = 0
    directory[offset + 3] = 0
    directory.writeUInt16LE(1, offset + 4)
    directory.writeUInt16LE(32, offset + 6)
    directory.writeUInt32LE(image.data.length, offset + 8)
    directory.writeUInt32LE(imageOffset, offset + 12)
    imageOffset += image.data.length
  }

  return Buffer.concat([header, directory, ...images.map((image) => image.data)])
}

async function writeFile(relativePath, data) {
  const target = path.join(projectRoot, relativePath)
  await fs.promises.mkdir(path.dirname(target), { recursive: true })
  await fs.promises.writeFile(target, data)
}

const renderedIcons = new Map()
for (const size of iconSizes) {
  const png = await renderPng(appIconSource, size)
  renderedIcons.set(size, png)
  await writeFile(`build/icons/${size}x${size}.png`, png)
}

await writeFile('public/icon.png', renderedIcons.get(1024))
await writeFile('icon.png', renderedIcons.get(1024))
await writeFile('public/default-avatar.png', await renderPng(avatarSource, 512))
await writeFile('public/icon.ico', createIco(icoSizes.map((size) => ({ size, data: renderedIcons.get(size) }))))

console.log('arkNote brand assets generated.')
