import { useLocalStorageCacheBool, useLocalStorageCacheInt, useLocalStorageCacheStringValue } from '@/composables/cache'

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
  VIDEO = 'video',
}

export function useBarBlur() {
  const blurSidebar = useLocalStorageCacheInt('blurSidebar', 4)
  const blurAppBar = useLocalStorageCacheInt('blurAppBar', 4)

  return {
    blurSidebar,
    blurAppBar,
  }
}

export function useBackground() {
  const backgroundType = useLocalStorageCacheStringValue<BackgroundType>('backgroundType', BackgroundType.NONE)
  const blur = useLocalStorageCacheInt('blur', 4)

  const blurMainBody = useLocalStorageCacheBool('blurMainBody', false)
  const backgroundImage = useLocalStorageCacheStringValue('background', '' as string)
  const backgroundImageFit = useLocalStorageCacheStringValue<'cover' | 'contain'>('imageFill', 'cover')
  const particleMode = useLocalStorageCacheStringValue<ParticleMode>('particleMode', ParticleMode.PUSH)
  const backgroundVideo = useLocalStorageCacheStringValue('backgroundVideo', '' as string)
  const volume = useLocalStorageCacheInt('volume', 0)
  async function setBackgroundVideo(path: string) {
    backgroundVideo.value = path
  }
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
    volume,
    blurMainBody,
    particleMode,
    backgroundType,
    backgroundImage,
    backgroundImageFit,
    setBackgroundImage,
    backgroundVideo,
    setBackgroundVideo,
  }
}
