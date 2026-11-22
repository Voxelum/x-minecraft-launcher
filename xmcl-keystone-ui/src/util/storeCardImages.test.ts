import { describe, expect, test } from 'vitest'
import { getCurseforgeCardImages, useStoreCardImages } from './storeCardImages'

const cdn = 'https://media.forgecdn.net/avatars'
const asset = (thumbnailUrl: string, url: string) => ({ id: 1, modId: 1360926, title: '', description: '', thumbnailUrl, url })
const errorAt = (src: string) => ({ currentTarget: { getAttribute: () => src } }) as unknown as Event

// Original logo from the reported pack; the corresponding CDN thumbnail path
// returns NoSuchKey. Gallery data below is synthetic.
const logo = asset(`${cdn}/thumbnails/1497/387/256/256/638972731634654794.webp`, `${cdn}/1497/387/638972731634654794.webp`)
const screenshot = asset(`${cdn}/thumbnails/1/2/256/256/preview.webp`, `${cdn}/1/2/preview.webp`)

describe('CurseForge search card images', () => {
  test('prefers thumbnails and retries each failed image with its own original', () => {
    const { iconUrl, gallery, imageFallbacks } = getCurseforgeCardImages({ logo, screenshots: [screenshot] })
    const { resolveImage, onImageError } = useStoreCardImages(() => imageFallbacks)
    expect(resolveImage(iconUrl)).toBe(logo.thumbnailUrl)
    expect(resolveImage(gallery[0])).toBe(screenshot.thumbnailUrl)

    onImageError(errorAt(gallery[0]))
    expect(resolveImage(gallery[0])).toBe(screenshot.url)
    expect(resolveImage(iconUrl)).toBe(logo.thumbnailUrl)
    onImageError(errorAt(iconUrl))
    expect(resolveImage(iconUrl)).toBe(logo.url)

    onImageError(errorAt(logo.url))
    expect(resolveImage(iconUrl)).toBe(logo.url)
  })

  test('uses available originals immediately and skips empty gallery entries', () => {
    const { iconUrl, gallery, imageFallbacks } = getCurseforgeCardImages({
      logo: asset('', logo.url),
      screenshots: [asset('', ''), asset('', screenshot.url), asset(screenshot.thumbnailUrl, screenshot.thumbnailUrl)],
    })
    expect(iconUrl).toBe(logo.url)
    expect(gallery).toEqual([screenshot.url, screenshot.thumbnailUrl])
    expect(imageFallbacks).toEqual({})
  })
})
