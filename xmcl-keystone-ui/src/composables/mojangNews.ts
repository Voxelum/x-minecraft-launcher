import { useRefreshable } from './refreshable'

export interface PlayPageImage {
  title: string
  url: string
}

export interface NewsPageImage {
  title: string
  url: string
  dimensions: {
    width: number
    height: number
  }

}
export interface NewsItem {
  title: string
  tag: string
  category: string
  date: string
  text: string
  playPageImage: PlayPageImage
  newsPageImage: NewsPageImage
  readMoreLink: string
  cardBorder: boolean
  newsType: string[]
  id: string
}
export function useMojangNews() {
  const news = ref([] as NewsItem[])

  const { refresh, refreshing, error } = useRefreshable(async() => {
    const resp = await fetch('https://launchercontent.mojang.com/news.json')
    const result: { version: number; entries: NewsItem[] } = await resp.json()
    if (result.version === 1) {
      const entries = result.entries.filter(e => e.category === 'Minecraft: Java Edition')
      for (const e of entries) {
        e.newsPageImage.url = new URL(e.newsPageImage.url, 'https://launchercontent.mojang.com').toString()
        e.playPageImage.url = new URL(e.playPageImage.url, 'https://launchercontent.mojang.com').toString()
      }
      news.value = entries
    } else {
    // error
    }
  })

  return {
    news,
    refresh,
    refreshing,
    error,
  }
}
