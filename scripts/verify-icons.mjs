import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const expectedPngSizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
const expectedIcoSizes = [16, 24, 32, 48, 64, 128, 256]

function readAsset(relativePath) {
  const fullPath = path.join(projectRoot, relativePath)
  const data = fs.readFileSync(fullPath)

  if (data.subarray(0, 43).toString('utf8').startsWith('version https://git-lfs.github.com/spec')) {
    throw new Error(`${relativePath} is a Git LFS pointer instead of an image`)
  }

  return data
}

function verifyPng(relativePath, expectedSize) {
  const data = readAsset(relativePath)

  if (data.length < 26 || !data.subarray(0, 8).equals(pngSignature)) {
    throw new Error(`${relativePath} is not a valid PNG`)
  }

  const width = data.readUInt32BE(16)
  const height = data.readUInt32BE(20)
  const colorType = data[25]

  if (width !== expectedSize || height !== expectedSize) {
    throw new Error(`${relativePath} must be ${expectedSize}x${expectedSize}, got ${width}x${height}`)
  }

  if (colorType !== 4 && colorType !== 6) {
    throw new Error(`${relativePath} must contain an alpha channel`)
  }
}

function verifyIco(relativePath) {
  const data = readAsset(relativePath)

  if (data.length < 6 || data.readUInt16LE(0) !== 0 || data.readUInt16LE(2) !== 1) {
    throw new Error(`${relativePath} is not a valid ICO`)
  }

  const imageCount = data.readUInt16LE(4)
  const sizes = []

  for (let index = 0; index < imageCount; index += 1) {
    const offset = 6 + index * 16
    if (offset + 16 > data.length) {
      throw new Error(`${relativePath} has a truncated image directory`)
    }

    const width = data[offset] || 256
    const height = data[offset + 1] || 256
    const bitsPerPixel = data.readUInt16LE(offset + 6)
    const imageLength = data.readUInt32LE(offset + 8)
    const imageOffset = data.readUInt32LE(offset + 12)

    if (width !== height || bitsPerPixel !== 32) {
      throw new Error(`${relativePath} contains an invalid ${width}x${height} ${bitsPerPixel}-bit entry`)
    }
    if (imageOffset + imageLength > data.length) {
      throw new Error(`${relativePath} contains a truncated ${width}x${height} entry`)
    }

    const embeddedPng = data.subarray(imageOffset, imageOffset + imageLength)
    if (!embeddedPng.subarray(0, 8).equals(pngSignature)) {
      throw new Error(`${relativePath} ${width}x${height} entry is not PNG encoded`)
    }
    if (embeddedPng.readUInt32BE(16) !== width || embeddedPng.readUInt32BE(20) !== height) {
      throw new Error(`${relativePath} ${width}x${height} entry has incorrect PNG dimensions`)
    }

    sizes.push(width)
  }

  if (sizes.join(',') !== expectedIcoSizes.join(',')) {
    throw new Error(`${relativePath} must contain sizes ${expectedIcoSizes.join(', ')}, got ${sizes.join(', ')}`)
  }
}

for (const source of ['build/ark-note-icon.svg', 'build/ark-note-avatar.svg']) {
  if (!readAsset(source).includes(Buffer.from('<svg'))) {
    throw new Error(`${source} is not a valid SVG source asset`)
  }
}

verifyPng('public/icon.png', 1024)
verifyPng('icon.png', 1024)
verifyPng('public/default-avatar.png', 512)
for (const size of expectedPngSizes) {
  verifyPng(`build/icons/${size}x${size}.png`, size)
}
verifyIco('public/icon.ico')

if (!readAsset('public/icon.png').equals(readAsset('icon.png'))) {
  throw new Error('Root and public application icons must be identical')
}

console.log('Application icon assets are valid.')
