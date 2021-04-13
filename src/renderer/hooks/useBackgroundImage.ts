import { watch } from '@vue/composition-api'
import { useLocalStorageCacheInt, useLocalStorageCacheStringValue } from './useCache'

export function useBackgroundImage() {
  const blur = useLocalStorageCacheInt('blur', 4)
  const backgroundImage = useLocalStorageCacheStringValue('background', '')
  async function setBackgroundImage(path: string) {
    const img = document.createElement('img')
    img.src = `image://${path}`
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.height = img.naturalHeight
      canvas.width = img.naturalWidth
      const context = canvas.getContext('2d')
      context?.drawImage(img, 0, 0)
      const png = canvas.toDataURL((img as any).mimeType ?? 'image/png')
      backgroundImage.value = png
    }
  }
  return {
    blur,
    backgroundImage,
    setBackgroundImage,
  }
}
