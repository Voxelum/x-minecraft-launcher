import type { Mod } from '@xmcl/curseforge'
import { reactive } from 'vue'

export function getCurseforgeCardImages(project: Pick<Mod, 'logo' | 'screenshots'>) {
  const fallbacks: [string, string][] = []
  const getSource = (asset: Mod['logo'] | undefined | null) => {
    const thumbnail = asset?.thumbnailUrl
    const original = asset?.url
    if (thumbnail && original && thumbnail !== original) {
      fallbacks.push([thumbnail, original])
    }
    return thumbnail || original || ''
  }
  const iconUrl = getSource(project.logo)
  const gallery = project.screenshots.map(getSource).filter(Boolean)
  return { iconUrl, gallery, imageFallbacks: Object.fromEntries(fallbacks) as Record<string, string> }
}

export function useStoreCardImages(getFallbacks: () => Readonly<Record<string, string>> | undefined) {
  const failedThumbnails = reactive(new Set<string>())
  const getFallback = (src: string) => {
    const fallbacks = getFallbacks()
    return fallbacks && Object.hasOwn(fallbacks, src) ? fallbacks[src] : undefined
  }
  return {
    resolveImage(src: string) {
      return (failedThumbnails.has(src) && getFallback(src)) || src
    },
    onImageError(event: Event) {
      // Read the failed element's source, not the current gallery slide: the
      // old image may still be leaving when the gallery rotates.
      const src = (event.currentTarget as HTMLImageElement).getAttribute('src')
      if (src && getFallback(src)) failedThumbnails.add(src)
    },
  }
}
