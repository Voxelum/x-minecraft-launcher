import { clientModrinthV2 } from '@/util/clients'
import { getModrinthVersionKey } from '@/util/modrinth'
import { get, MaybeRef } from '@vueuse/core'
import { ProjectVersion } from '@xmcl/modrinth'
import { InjectionKey, Ref } from 'vue'
import { useSWRVModel } from './swrv'
import { kSWRVConfig } from './swrvConfig'
import { useTask } from './task'

export const kModrinthVersions: InjectionKey<ReturnType<typeof useModrinthVersions>> =
  Symbol('kModrinthVersions')
export const kModrinthVersionsHolder: InjectionKey<Ref<Record<string, ProjectVersion>>> =
  Symbol('ModrinthVersionsHolder')

export function useModrinthVersions(
  project: Ref<string>,
  featured?: boolean,
  loader?: Ref<string | undefined>,
  gameVersions?: Ref<string[] | undefined>,
) {
  const holder = inject(kModrinthVersionsHolder, undefined)

  const {
    mutate,
    error,
    isValidating: refreshing,
    data,
  } = useSWRVModel(
    getModrinthVersionModel(project, featured, loader, gameVersions),
    inject(kSWRVConfig),
  )

  if (holder) {
    watch(
      data,
      (result) => {
        if (holder && result) {
          const newHolder = { ...holder.value }
          for (const v of result) {
            newHolder[v.id] = v
          }
          holder.value = newHolder
        }
      },
      { immediate: true },
    )
  }

  return {
    refreshing,
    refresh: () => mutate(),
    error,
    versions: computed(() => data.value || []),
  }
}

export function getModrinthVersionModel(
  project: MaybeRef<string | undefined>,
  featured?: boolean,
  loaders?: MaybeRef<string | undefined>,
  gameVersions?: MaybeRef<string[] | undefined>,
) {
  return {
    key: computed(() =>
      getModrinthVersionKey(get(project) || '', featured, get(loaders), get(gameVersions)),
    ),
    fetcher: async () => {
      const projectId = get(project)
      if (!projectId) {
        return []
      }
      const loader = get(loaders)
      const result = (
        await clientModrinthV2.getProjectVersions(projectId, {
          loaders: loader ? [loader] : undefined,
          gameVersions: get(gameVersions),
          featured,
        })
      ).map(markRaw)
      return result
    },
  }
}

export function useModrinthTask(versionId: Ref<string>) {
  return useTask((t) => t.type === 'installModrinthFile' && t.versionId === versionId.value)
}
