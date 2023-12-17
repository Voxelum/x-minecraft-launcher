import { clientFTB } from '@/util/clients'
import { CachedFTBModpackVersionManifest, FTBVersion } from '@xmcl/runtime-api'
import useSWRV from 'swrv'
import { Ref } from 'vue'
import { kSWRVConfig } from './swrvConfig'
import { useLocalStorageCache } from './cache'

interface FeedTheBeastProps {
  keyword?: string
}

export function useFeedTheBeast(props: FeedTheBeastProps) {
  const router = useRouter()

  const currentKeyword = computed({
    get() { return props.keyword ?? '' },
    set(v: string) {
      router.replace({ query: { ...router.currentRoute.query, keyword: v } })
    },
  })

  const { data, isValidating: refreshing } = useSWRV(computed(() => `/ftb?keyword=${currentKeyword.value}`), async () => {
    return !currentKeyword.value ? await clientFTB.getFeaturedModpacks() : await clientFTB.searchModpacks({ keyword: currentKeyword.value })
  }, inject(kSWRVConfig))

  return {
    data,
    refreshing,
    currentKeyword,
  }
}

export function useFeedTheBeastProject(id: Ref<number>) {
  const { data: manifest, error, isValidating: refreshing, mutate } = useSWRV(computed(() => `/ftb/${id.value}`),
    () => clientFTB.getModpackManifest(id.value), inject(kSWRVConfig))

  return {
    manifest,
    refreshing,
    error,
  }
}

export function useFeedTheBeastChangelog(version: Ref<{ id: number; version: FTBVersion }>) {
  const { data, error, isValidating } = useSWRV(computed(() => `/ftb/${version.value.id}/${version.value.version.id}/changelog`), () => clientFTB.getModpackVersionChangelog({
    modpack: version.value.id,
    version: version.value.version,
  }), inject(kSWRVConfig))
  return {
    refreshing: isValidating,
    changelog: data,
    error,
  }
}

export function useFeedTheBeastProjectVersion(project: Ref<number>, version: Ref<FTBVersion>) {
  const { isValidating: refreshing, data: versionManifest, error } = useSWRV(computed(() => `/ftb/${version.value.id}/${version.value.id}`), async () => {
    return clientFTB.getModpackVersionManifest({
      modpack: project.value,
      version: version.value,
    })
  }, inject(kSWRVConfig))

  return {
    refreshing,
    error,
    versionManifest,
  }
}

export function useGetFeedTheBeastVersionsCache() {
  function getFTBModpackVersionManifests() {
    const item = localStorage.getItem('cachedFTB')
    if (item) {
      try {
        return JSON.parse(item) as CachedFTBModpackVersionManifest[]
      } catch { }
    }
    return []
  }

  return {
    getFeaturedModpacks: getFTBModpackVersionManifests,
  }
}

export function useFeedTheBeastVersionsCache() {
  const ftb: Ref<CachedFTBModpackVersionManifest[]> = useLocalStorageCache('cachedFTB', () => [], JSON.stringify, JSON.parse, {
    deep: true,
  })

  function dispose() {
    ftb.value = []
  }

  return {
    cache: ftb,
    dispose,
  }
}
