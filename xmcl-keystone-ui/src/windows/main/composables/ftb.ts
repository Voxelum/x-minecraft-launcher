import { Ref } from '@vue/composition-api'
import { FTBVersion, FeedTheBeastServiceKey, FTBModpackManifest, FTBModpackVersionManifest } from '@xmcl/runtime-api'
import { useRefreshable, useRouter, useService } from '/@/composables'

interface FeedTheBeastProps {
  keyword?: string
}

export function useFeedTheBeast(props: FeedTheBeastProps) {
  const { state, searchModpacks, getFeaturedModpacks, getModpackManifest } = useService(FeedTheBeastServiceKey)
  const router = useRouter()

  const currentKeyword = computed({
    get() { return props.keyword ?? '' },
    set(v: string) {
      router.replace({ query: { ...router.currentRoute.query, keyword: v } })
    },
  })

  const modpacks = ref([] as number[])

  const { refresh, refreshing } = useRefreshable(async () => {
    const result = !currentKeyword.value ? await getFeaturedModpacks() : await searchModpacks({ keyword: currentKeyword.value })
    modpacks.value = result.packs
  })

  watch(currentKeyword, () => {
    refresh()
  })

  return {
    refresh,
    refreshing,
    currentKeyword,
    modpacks,
  }
}

export function useFeedTheBeastProject(id: Ref<number>) {
  const { getModpackManifest } = useService(FeedTheBeastServiceKey)

  const manifest: Ref<FTBModpackManifest | undefined> = ref(undefined)
  const { refresh, refreshing } = useRefreshable(async () => {
    manifest.value = await getModpackManifest(id.value)
  })

  onMounted(() => { refresh() })

  return {
    manifest,
    refresh,
    refreshing,
  }
}

export function useFeedTheBeastProjectVersion(project: Ref<number>, version: Ref<FTBVersion>) {
  const { getModpackVersionManifest } = useService(FeedTheBeastServiceKey)

  const versionManifest: Ref<FTBModpackVersionManifest | undefined> = ref(undefined)
  const { refresh, refreshing } = useRefreshable(async () => {
    versionManifest.value = await getModpackVersionManifest({
      modpack: project.value,
      version: version.value,
    })
  })

  return {
    refresh,
    refreshing,
    versionManifest,
  }
}
