import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const expectedPngSizes = [16, 24, 32, 48, 64, 128, 256, 512]
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

    if (width !== height || bitsPerPixel !== 32) {
      throw new Error(`${relativePath} contains an invalid ${width}x${height} ${bitsPerPixel}-bit entry`)
    }

    sizes.push(width)
  }

  if (sizes.join(',') !== expectedIcoSizes.join(',')) {
    throw new Error(`${relativePath} must contain sizes ${expectedIcoSizes.join(', ')}, got ${sizes.join(', ')}`)
  }
}

verifyPng('public/icon.png', 512)
for (const size of expectedPngSizes) {
  verifyPng(`build/icons/${size}x${size}.png`, size)
}
verifyIco('public/icon.ico')

console.log('Application icon assets are valid.')
