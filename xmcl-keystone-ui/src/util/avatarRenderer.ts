export function renderMinecraftPlayerTextHead(textureUrl: string) {
  // Load minecraft player texture from url into canvas
  // We need to also render the head part/overlay of the texture
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = textureUrl
  return new Promise<string>((resolve, reject) => {
    img.onload = () => {
      // canvas only show head part
      canvas.width = 8
      canvas.height = 8
      // Draw head
      ctx.drawImage(img, 8, 8, 8, 8, 0, 0, 8, 8)
      // Draw front head overlay
      ctx.drawImage(img, 40, 8, 8, 8, 0, 0, 8, 8)
      // Convert canvas to data url
      const dataUrl = canvas.toDataURL()
      // Set the data url to the image
      resolve(dataUrl)
    }
    img.onerror = reject
  })
}
