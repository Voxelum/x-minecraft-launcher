/**
 * Minecraft still accepts legacy 64x32 skins in a few places, but the game
 * renders the texture as a 64x64 atlas. Convert legacy skins before they are
 * uploaded so every consumer receives the same canonical texture.
 */
export function normalizeSkinImage(source: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (image.width !== image.height && image.width !== image.height * 2) {
        reject(new Error(`Bad skin size: ${image.width}x${image.height}`))
        return
      }

      const size = image.width
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('Unable to process skin image'))
        return
      }
      context.imageSmoothingEnabled = false
      context.clearRect(0, 0, size, size)
      context.drawImage(image, 0, 0, size, image.height)

      if (image.width === image.height * 2) {
        // This is the same face-by-face mapping used by skinview-utils. The
        // horizontal flip is required because the old atlas mirrored limbs.
        context.save()
        context.scale(-1, 1)
        const scale = size / 64
        const copy = (sx: number, sy: number, width: number, height: number, dx: number, dy: number) => {
          context.drawImage(context.canvas, sx * scale, sy * scale, width * scale, height * scale, -dx * scale, dy * scale, -width * scale, height * scale)
        }
        copy(4, 16, 4, 4, 20, 48)
        copy(8, 16, 4, 4, 24, 48)
        copy(0, 20, 4, 12, 24, 52)
        copy(4, 20, 4, 12, 20, 52)
        copy(8, 20, 4, 12, 16, 52)
        copy(12, 20, 4, 12, 28, 52)
        copy(44, 16, 4, 4, 36, 48)
        copy(48, 16, 4, 4, 40, 48)
        copy(40, 20, 4, 12, 40, 52)
        copy(44, 20, 4, 12, 36, 52)
        copy(48, 20, 4, 12, 32, 52)
        copy(52, 20, 4, 12, 44, 52)
        context.restore()
      }
      resolve(canvas.toDataURL('image/png'))
    }
    image.onerror = () => reject(new Error('Unable to load skin image'))
    image.src = source
  })
}
