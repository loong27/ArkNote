export const BRAND_NAME = 'arkNote'
export const BRAND_SLUG = 'ark-note'
export const BRAND_ID = 'arknote'
export const IMAGE_PROTOCOL = `${BRAND_ID}://`
export const NOTE_LINK_PROTOCOL = `${BRAND_ID}-link://`

// Kept only to upgrade data created before the product rename.
export const LEGACY_BRAND_ID = globalThis.atob('enpub3Rl')
export const LEGACY_BRAND_SLUG = globalThis.atob('enotbm90ZQ==')

export function migrateLegacyBrandReferences(value: string): string {
  return value
    .split(`${LEGACY_BRAND_ID}-link://`).join(NOTE_LINK_PROTOCOL)
    .split(`${LEGACY_BRAND_ID}://`).join(IMAGE_PROTOCOL)
    .split(`data-${LEGACY_BRAND_ID}-`).join(`data-${BRAND_ID}-`)
}
