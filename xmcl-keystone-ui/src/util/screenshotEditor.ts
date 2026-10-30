/** Contexts belong to canvas elements, not the longer-lived editor component. */
export function screenshotCanvasContext(canvas: HTMLCanvasElement | null) {
  return canvas?.getContext('2d') ?? null
}

/** Ignore image completions from a previous dialog opening or screenshot. */
export function createScreenshotImageLoader(createImage = () => new Image()) {
  let generation = 0
  return {
    cancel() { generation++ },
    load(url: string, ready: (image: HTMLImageElement) => void) {
      const request = ++generation
      const image = createImage()
      image.crossOrigin = 'anonymous'
      image.onload = () => { if (request === generation) ready(image) }
      image.src = url
    },
  }
}
