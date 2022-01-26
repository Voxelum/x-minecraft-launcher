import { watch } from '@vue/composition-api'
import { useLocalStorageCacheBool, useLocalStorageCacheInt, useLocalStorageCacheStringValue } from './useCache'

export enum ParticleMode {
  PUSH = 'push',
  REMOVE = 'remove',
  REPULSE = 'repulse',
  BUBBLE = 'bubble',
}

export enum BackgroundType {
  NONE = 'none',
  PARTICLE = 'particle',
  HALO = 'halo',
  IMAGE = 'image',
}

export function useBackground() {
  const backgroundType = useLocalStorageCacheStringValue('backgroundType', BackgroundType.HALO)
  const blur = useLocalStorageCacheInt('blur', 4)
  const blurMainBody = useLocalStorageCacheBool('blurMainBody', false)
  const backgroundImage = useLocalStorageCacheStringValue('background', '')
  const particleMode = useLocalStorageCacheStringValue<ParticleMode>('particleMode', ParticleMode.PUSH)
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
    blurMainBody,
    particleMode,
    backgroundType,
    backgroundImage,
    setBackgroundImage,
  }
}
