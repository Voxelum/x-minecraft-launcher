import { expect, test } from 'vitest'
import { createScreenshotImageLoader, screenshotCanvasContext } from './screenshotEditor'

test('reopened editor draws onto the replacement canvas, never its detached predecessor', () => {
  const first = { id: 'old-context' }
  const second = { id: 'new-context' }
  const oldCanvas = { getContext: () => first } as unknown as HTMLCanvasElement
  const newCanvas = { getContext: () => second } as unknown as HTMLCanvasElement
  expect(screenshotCanvasContext(oldCanvas)).toBe(first)
  expect(screenshotCanvasContext(null)).toBe(null)
  expect(screenshotCanvasContext(newCanvas)).toBe(second)
})

test('close/reopen and out-of-order image loads cannot replace the current image', () => {
  const images: HTMLImageElement[] = []
  const loader = createScreenshotImageLoader(() => {
    const image = {} as HTMLImageElement
    images.push(image)
    return image
  })
  const ready: string[] = []
  loader.load('first.png', () => ready.push('first'))
  loader.cancel()
  loader.load('second.png', () => ready.push('second'))
  images[0].onload!(new Event('load'))
  images[1].onload!(new Event('load'))
  expect(ready).toEqual(['second'])
  loader.load('third.png', () => ready.push('third'))
  loader.cancel()
  images[2].onload!(new Event('load'))
  expect(ready).toEqual(['second'])
})
