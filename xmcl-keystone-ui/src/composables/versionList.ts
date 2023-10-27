import { Ref } from 'vue'
import { ForgeVersion, LocalVersionHeader, LockKey } from '@xmcl/runtime-api'
import { useFabricVersions, useForgeVersions, useLabyModManifest, useMinecraftVersions, useNeoForgedVersions, useOptifineVersions, useQuiltVersions } from './version'
import { kSemaphores } from '@/composables'
import { getLocalDateString } from '@/util/date'
import { injection } from '@/util/inject'

export interface VersionItem {
  tag?: string
  tagColor?: string
  folder: string
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

export function useMinecraftVersionList(version: Ref<string>, local: Ref<LocalVersionHeader[]>) {
  const { versions: vers, installed, refreshing, release } = useMinecraftVersions(local)
  const { t } = useI18n()
  const showAlpha = ref(false)
  const { semaphores } = injection(kSemaphores)
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
          status: computed(() => semaphores[key] > 0 ? 'installing' : installed.value[v.id] ? 'local' : 'remote'),
          folder: computed(() => installed.value[v.id]),
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
    refreshing,
  }
}

export function useNeoForgedVersionList(minecraft: Ref<string>, version: Ref<string>, local: Ref<LocalVersionHeader[]>) {
  const { versions, installed, latest, recommended, refresh, refreshing, error } = useNeoForgedVersions(local)
  const { semaphores } = injection(kSemaphores)
  const { t } = useI18n()

  const items = computed(() => {
    const vers = versions.value
    const result: VersionItem[] = vers
      .filter(v => v.startsWith(minecraft.value))
      .map(v => {
        const key = LockKey.version(`neoforge-${v}`)
        return reactive({
          name: v,
          status: computed(() => {
            const status = semaphores[key] > 0 ? 'installing' : installed.value[v] ? 'local' : 'remote'
            return status
          }),
          folder: computed(() => {
            const folder = installed.value[v]
            return folder ?? ''
          }),
          description: '',
          isSelected: computed(() => version.value === v),
          tag: recommended.value === v
            ? t('forgeVersion.recommended')
            : latest.value === v ? t('forgeVersion.latest') : '',
          tagColor: recommended.value === v ? 'primary' : '',
          instance: markRaw({ version }),
        })
      })
    return result
  })

  return {
    items,
    refreshing,
    refresh,
    error,
  }
}

export function useForgeVersionList(minecraft: Ref<string>, version: Ref<string>, local: Ref<LocalVersionHeader[]>) {
  const { versions, refreshing, refresh, installed } = useForgeVersions(minecraft, local)
  const { semaphores } = injection(kSemaphores)
  const { t } = useI18n()

  const recommendedOnly = ref(false)
  const canShowBuggy = ref(false)

  function filterForge(version: ForgeVersion) {
    if (recommendedOnly.value && version.type !== 'recommended' && version.type !== 'latest') { return false }
    if (canShowBuggy.value && version.type !== 'buggy') { return true }
    return true
  }
  const items = computed(() => {
    const result: VersionItem[] = (versions.value ?? [])
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
            const status = semaphores[key] > 0 ? 'installing' : installed.value[v.version] ? 'local' : 'remote'
            return status
          }),
          folder: computed(() => {
            const folder = installed.value[v.version]
            return folder ?? ''
          }),
          description: v.date ? getLocalDateString(v.date) : '',
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

export function useOptifineVersionList(minecraft: Ref<string>, forge: Ref<string>, version: Ref<string>, local: Ref<LocalVersionHeader[]>) {
  const { semaphores } = injection(kSemaphores)
  const { versions, installed, refreshing } = useOptifineVersions(minecraft, forge, local)

  const items = computed(() => {
    return [...versions.value].sort((a, b) => {
      const { patch, type } = a
      // compare type first and then the patch
      const result = type.localeCompare(b.type)
      if (result === 0) {
        return -patch.localeCompare(b.patch)
      }
      return -result
    }).map((v) => {
      const key = LockKey.version(`optifine-${minecraft.value}-${v.type}_${v.patch}`)
      const name = v.type + '_' + v.patch
      const result: VersionItem = reactive({
        name,
        description: v.patch,
        isSelected: computed(() => version.value === name),
        folder: computed(() => installed.value[`${v.type}_${v.patch}`] ?? ''),
        status: computed(() => semaphores[key] > 0 ? 'installing' : installed.value[`${v.type}_${v.patch}`] ? 'local' : 'remote'),
        instance: markRaw(v),
      })

      return result
    })
  })

  return {
    items,
    refreshing,
  }
}

export function useFabricVersionList(minecraft: Ref<string>, version: Ref<string>, local: Ref<LocalVersionHeader[]>) {
  const { semaphores } = injection(kSemaphores)
  const { t } = useI18n()
  const showStableOnly = ref(false)
  const { versions, refreshing, installed } = useFabricVersions(minecraft, local)
  const items = computed(() => {
    const result: VersionItem[] = versions.value
      .filter((v) => !showStableOnly.value || v.stable)
      .map((v) => {
        const key = LockKey.version(`fabric-${minecraft.value}-${v.version}`)
        return reactive({
          name: v.version,
          status: computed(() => {
            const status = semaphores[key] > 0 ? 'installing' : installed.value[v.version] ? 'local' : 'remote'
            return status
          }),
          folder: computed(() => installed.value[v.version] ?? ''),
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
    refreshing,
    showStableOnly,
  }
}

export function useQuiltVersionList(minecraft: Ref<string>, version: Ref<string>, local: Ref<LocalVersionHeader[]>) {
  const { semaphores } = injection(kSemaphores)
  const { versions, refresh, refreshing, installed } = useQuiltVersions(minecraft, local)
  const items = computed(() => {
    const result: VersionItem[] = (versions.value ?? [])
      .map((v) => {
        return reactive({
          name: v.version,
          status: computed(() => {
            const key = LockKey.version(`quilt-${minecraft.value}-${v.version}`)
            const status = semaphores[key] > 0 ? 'installing' : installed.value[v.version] ? 'local' : 'remote'
            return status
          }),
          folder: computed(() => installed.value[v.version] ?? ''),
          isSelected: computed(() => version.value === v.version),
          description: v.maven,
          // tag: v.stable ? t('fabricVersion.stable') : t('fabricVersion.unstable'),
          // tagColor: v.stable ? 'primary' : undefined,
          instance: computed(() => ({
            minecraftVersion: minecraft.value,
            version: v.version,
          })),
        })
      })
    return result
  })

  return {
    items,
    refresh,
    refreshing,
  }
}

export function useLabyModVersionList(minecraft: Ref<string>, version: Ref<string>, local: Ref<LocalVersionHeader[]>) {
  const { data, isValidating, mutate } = useLabyModManifest()

  const items = computed(() => {
    const manifest = data.value
    if (!manifest) { return [] }
    const mcVersion = manifest.minecraftVersions.find(v => v.tag === minecraft.value)
    if (!mcVersion) { return [] }
    const result: VersionItem[] = [reactive({
      name: manifest.labyModVersion,
      status: 'remote',
      description: manifest.commitReference,
      folder: computed(() => local.value.find((v) => v.labyMod === manifest.labyModVersion)?.path ?? ''),
      isSelected: computed(() => version.value === manifest.labyModVersion),
      instance: markRaw(mcVersion),
    })]
    return result
  })

  return {
    items,
    refreshing: isValidating,
    refresh: () => mutate(),
  }
}
