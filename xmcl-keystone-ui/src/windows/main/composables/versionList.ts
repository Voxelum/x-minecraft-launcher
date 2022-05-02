import { Ref } from '@vue/composition-api'
import { ForgeVersion, LockKey } from '@xmcl/runtime-api'
import { useFabricVersions, useForgeVersions, useMinecraftVersions, useOptifineVersions } from './version'
import { SERVICES_SEMAPHORES_KEY, useI18n } from '/@/composables'
import { injection } from '/@/util/inject'

export interface VersionItem {
  tag?: string
  tagColor?: string
  name: string
  description?: string
  status: 'local' | 'remote' | 'installing'
  isSelected: boolean
  instance: object
}

export interface VersionMenuItem {
  name: string
  tag?: string
  tagColor?: string
}

export function useMinecraftVersionList(version: Ref<string>) {
  const { versions: vers, statuses, refreshing, refresh, release } = useMinecraftVersions()
  const { t } = useI18n()
  const showAlpha = ref(false)
  const { semaphores } = injection(SERVICES_SEMAPHORES_KEY)
  const items = computed(() => {
    const result = vers.value
      .filter(v => showAlpha.value || v.type === 'release')
      .map(v => {
        const key = LockKey.version(v.id)
        const item: VersionItem = reactive({
          name: v.id,
          description: v.releaseTime,
          tag: v.type === 'snapshot' ? t('minecraftVersion.snapshot') : v.type === 'release' ? t('minecraftVersion.release') : '',
          tagColor: v.type === 'release' ? 'primary' : '',
          isSelected: computed(() => version.value === v.id),
          status: computed(() => semaphores[key] > 0 ? 'installing' : statuses.value[key]),
          instance: markRaw(v),
        })
        return item
      })
    return result
  })

  return {
    release,
    showAlpha,
    items,
    refresh,
    refreshing,
  }
}

export function useForgeVersionList(minecraft: Ref<string>, version: Ref<string>) {
  const { statuses, versions, refreshing, refresh } = useForgeVersions(minecraft)
  const { semaphores } = injection(SERVICES_SEMAPHORES_KEY)
  const { t } = useI18n()

  const recommendedOnly = ref(false)
  const canShowBuggy = ref(false)

  function filterForge(version: ForgeVersion) {
    if (recommendedOnly.value && version.type !== 'recommended' && version.type !== 'latest') { return false }
    if (canShowBuggy.value && version.type !== 'buggy') { return true }
    return true
  }
  const items = computed(() => {
    const result: VersionItem[] = versions.value
      .filter(filterForge).sort((a, b) => {
        if (a.date && b.date) {
          // @ts-ignore
          return new Date(b.date) - (new Date(a.date))
        }
        return b.version.localeCompare(a.version)
      })
      .map(v => {
        const key = LockKey.version(`forge-${minecraft.value}-${v.version}`)
        return reactive({
          name: v.version,
          status: computed(() => {
            const status = semaphores[key] > 0 ? 'installing' : statuses.value[v.version]
            return status
          }),
          description: v.date ? new Date(v.date).toLocaleDateString() : '',
          isSelected: computed(() => version.value === v.version),
          tag: v.type === 'recommended' ? t('forgeVersion.recommended') : v.type === 'latest' ? t('forgeVersion.latest') : '',
          tagColor: v.type === 'recommended' ? 'primary' : '',
          instance: markRaw(v),
        })
      })
    return result
  })

  return {
    items,
    recommendedOnly,
    canShowBuggy,
    refreshing,
    refresh,
  }
}

export function useOptifineVersionList(minecraft: Ref<string>, version: Ref<string>) {
  const { t } = useI18n()
  const { semaphores } = injection(SERVICES_SEMAPHORES_KEY)
  const { versions, statuses, refreshing, refresh } = useOptifineVersions(minecraft)

  const items = computed(() => {
    return versions.value.map((v) => {
      const key = LockKey.version(`optifine-${minecraft.value}-${v.type}_${v.patch}`)
      const result: VersionItem = reactive({
        name: minecraft.value + '_' + v.type + '_' + v.patch,
        description: v.patch,
        // tag: v.type === 'snapshot' ? t('minecraftVersion.snapshot') : v.type === 'release' ? t('minecraftVersion.release') : '',
        // tagColor: v.type === 'release' ? 'primary' : '',
        isSelected: computed(() => version.value === (v.type + '_' + v.patch)),
        status: computed(() => semaphores[key] > 0 ? 'installing' : statuses.value[minecraft.value + '_' + v.type + '_' + v.patch]),
        instance: markRaw(v),
      })

      return result
    })
  })

  return {
    items,
    refreshing,
    refresh,
  }
}

export function useFabricVersionList(minecraft: Ref<string>, version: Ref<string>) {
  const { semaphores } = injection(SERVICES_SEMAPHORES_KEY)
  const { t } = useI18n()
  const showStableOnly = ref(false)
  const { yarnVersions, loaderVersions, getStatus, refresh, refreshing } = useFabricVersions(minecraft)
  const isFabricSupported = computed(() => !!yarnVersions.value.find(v => v.gameVersion === minecraft.value))
  const items = computed(() => {
    if (!isFabricSupported.value) {
      return []
    }
    const result: VersionItem[] = loaderVersions.value
      .filter((v) => !showStableOnly.value || v.stable)
      .map((v) => {
        const key = LockKey.version(`fabric-${minecraft.value}-${v.version}`)
        return reactive({
          name: v.version,
          status: computed(() => {
            const status = semaphores[key] > 0 ? 'installing' : getStatus(v.version)
            return status
          }),
          isSelected: computed(() => version.value === v.version),
          description: v.maven,
          tag: v.stable ? t('fabricVersion.stable') : t('fabricVersion.unstable'),
          tagColor: v.stable ? 'primary' : undefined,
          instance: markRaw(v),
        })
      })
    return result
  })

  return {
    items,
    refresh,
    refreshing,
    showStableOnly,
  }
}
