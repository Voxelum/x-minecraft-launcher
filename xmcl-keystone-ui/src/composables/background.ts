import { useLocalStorageCacheBool, useLocalStorageCacheInt, useLocalStorageCacheStringValue } from '@/composables/cache'

import { InjectionKey } from 'vue'

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
export const kBackground: InjectionKey<ReturnType<typeof useBackground>> = Symbol('Background')

export function useBackground() {
  const backgroundType = useLocalStorageCacheStringValue<BackgroundType>('backgroundType', BackgroundType.NONE, {
    migrate: (v) => {
      if (v.startsWith('image:')) {
        let path = v.substring('image:'.length)
        if (path.startsWith('/')) path = path.substring(1)
        const url = new URL('http://launcher/media')
        url.searchParams.append('path', path)
        return url.toString()
      }
      return v
    },
  })
  const blur = useLocalStorageCacheInt('blur', 4)

  const blurMainBody = useLocalStorageCacheBool('blurMainBody', false)
  const backgroundImage = useLocalStorageCacheStringValue('background', '' as string)
  const backgroundImageFit = useLocalStorageCacheStringValue<'cover' | 'contain'>('imageFill', 'cover')
  const particleMode = useLocalStorageCacheStringValue<ParticleMode>('particleMode', ParticleMode.PUSH)
  const backgroundVideo = useLocalStorageCacheStringValue('backgroundVideo', '' as string, {
    migrate: (v) => {
      if (v.startsWith('video:')) {
        let path = v.substring('video:'.length)
        if (path.startsWith('/')) path = path.substring(1)
        const url = new URL('http://launcher/media')
        url.searchParams.append('path', path)
        return url.toString()
      }
      return v
    },
  })
  const volume = useLocalStorageCacheInt('volume', 0)
  async function setBackgroundVideo(path: string) {
    const url = new URL('http://launcher/media')
    url.searchParams.append('path', path)
    backgroundVideo.value = url.toString()
  }
  async function setBackgroundImage(path: string) {
    const img = document.createElement('img')
    const url = new URL('http://launcher/media')
    url.searchParams.append('path', path)
    img.src = url.toString()
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
