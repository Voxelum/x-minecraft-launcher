import { Ref } from 'vue'
import { FTBVersion, FTBModpackManifest, FTBModpackVersionManifest, CachedFTBModpackVersionManifest } from '@xmcl/runtime-api'
import { useRefreshable, useService } from '@/composables'
import { FTBClient } from '@/util/ftbClient'
import useSWRV from 'swrv'
import LocalStorageCache from 'swrv/dist/cache/adapters/localStorage'
import { LocalStroageCache } from '@/util/localStorageCache'

interface FeedTheBeastProps {
  keyword?: string
}

export function useClient() {

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
    return !currentKeyword.value ? await client.getFeaturedModpacks() : await client.searchModpacks({ keyword: currentKeyword.value })
  }, { cache })

  return {
    data,
    refreshing,
    currentKeyword,
  }
}

export function useFeedTheBeastProject(id: Ref<number>) {
  const { data: manifest, error, isValidating: refreshing, mutate } = useSWRV(computed(() => `/ftb/${id.value}`),
    () => client.getModpackManifest(id.value), { cache })

  return {
    manifest,
    refreshing,
    error,
  }
}
const client = new FTBClient()
const cache = new LocalStroageCache('/cache')

export function useFeedTheBeastChangelog(version: Ref<{ id: number; version: FTBVersion }>) {
  const { data, error, isValidating } = useSWRV(computed(() => `/ftb/${version.value.id}/${version.value.version.id}/changelog`), () => client.getModpackVersionChangelog({
    modpack: version.value.id,
    version: version.value.version,
  }), {
    cache,
  })
  return {
    refreshing: isValidating,
    changelog: data,
    error,
  }
}

export function useFeedTheBeastProjectVersion(project: Ref<number>, version: Ref<FTBVersion>) {
  const { isValidating: refreshing, data: versionManifest, error } = useSWRV(computed(() => `/ftb/${version.value.id}/${version.value.id}`), async () => {
    return client.getModpackVersionManifest({
      modpack: project.value,
      version: version.value,
    })
  }, { cache })

  return {
    refreshing,
    error,
    versionManifest,
  }
}

export function useFeedTheBeastVersionsCache() {
  const ftb: Ref<CachedFTBModpackVersionManifest[]> = ref([])

  function dispose() {
    ftb.value = []
  }

  return {
    cache: ftb,
    dispose,
  }
}
