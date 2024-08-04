import { clientFTB } from '@/util/clients'
import { getFTBTemplateAndFile } from '@/util/ftb'
import { injection } from '@/util/inject'
import { generateDistinctName } from '@/util/instanceName'
import { CachedFTBModpackVersionManifest, CreateInstanceOption, FTBModpackManifest, FTBModpackVersionManifest, FTBVersion, InstanceServiceKey } from '@xmcl/runtime-api'
import useSWRV from 'swrv'
import { Ref } from 'vue'
import { useLocalStorageCache } from './cache'
import { kInstanceFiles } from './instanceFiles'
import { kInstanceVersion } from './instanceVersion'
import { kInstanceVersionInstall } from './instanceVersionInstall'
import { kInstances } from './instances'
import { kJavaContext } from './java'
import { useService } from './service'
import { kSWRVConfig } from './swrvConfig'

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

export function getFeedTheBeastProjectModel(id: Ref<number>) {
  return {
    key: computed(() => `/ftb/${id.value}`),
    fetcher: () => clientFTB.getModpackManifest(id.value),
  }
}

export function getFeedTheBeastVersionModel(id: Ref<number>, version: Ref<FTBVersion>) {
  return {
    key: computed(() => `/ftb/${id.value}/${version.value.id}`),
    fetcher: () => clientFTB.getModpackVersionManifest({
      modpack: id.value,
      version: version.value,
    }),
  }
}

export function getFeedTheBeastVersionChangelogModel(id: Ref<number>, version: Ref<number>) {
  return {
    key: computed(() => `/ftb/${id.value}/${version.value}/changelog`),
    fetcher: () => clientFTB.getModpackVersionChangelog({
      modpack: id.value,
      version: { id: version.value },
    }),
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

export function useFeedTheBeastModpackInstall() {
  const { cache } = useFeedTheBeastVersionsCache()
  const { createInstance } = useService(InstanceServiceKey)
  const { all } = injection(kJavaContext)
  const { instances, selectedInstance } = injection(kInstances)
  const { getVersionHeader, getResolvedVersion } = injection(kInstanceVersion)
  const { currentRoute, push } = useRouter()
  const { getInstallInstruction, handleInstallInstruction, getInstanceLock } = injection(kInstanceVersionInstall)
  const { installFiles } = injection(kInstanceFiles)

  async function installModpack(versionManifest: FTBModpackVersionManifest, man: FTBModpackManifest) {
    const cached = {
      ...versionManifest,
      iconUrl: man.art.find(a => a.type === 'square')?.url ?? '',
      projectName: man.name,
      authors: man.authors,
    }
    cache.value.push(cached)

    const [config, files] = getFTBTemplateAndFile(cached, all.value)

    const name = generateDistinctName(config.name, instances.value.map(i => i.name))

    const existed = getVersionHeader(config.runtime, '')
    const options: CreateInstanceOption = {
      ...config,
      name,
    }
    if (existed) {
      options.version = existed.id
    }

    const path = await createInstance(options)
    selectedInstance.value = path
    if (currentRoute.path !== '/') {
      push('/')
    }

    installFiles(path, files)

    const lock = getInstanceLock(path)
    lock.write(async () => {
      const resolved = existed ? await getResolvedVersion(existed) : undefined
      const instruction = await getInstallInstruction(path, config.runtime, options.version || '', resolved, all.value)
      await handleInstallInstruction(instruction)
    })
  }
  return {
    installModpack,
  }
}
