import { clientModrinthV2, clientModrinchV2Locale } from '@/util/clients'
import useSWRV from 'swrv'
import { Ref } from 'vue'
import { kSWRVConfig } from './swrvConfig'
import { getModrinthProjectKey } from '@/util/modrinth'
import { kFlights } from './flights'

export function useModrinthProject(id: Ref<string>) {
  const config = inject(kSWRVConfig)

  const {
    data,
    isValidating,
    error,
    mutate,
  } = useSWRV(computed(() => getModrinthProjectKey(id.value)),
    async (key) => {
      const cacheKey = getModrinthProjectKey(id.value)
      if (cacheKey === key) {
        return clientModrinthV2.getProject(id.value)
      } else {
        const realId = key.split('/')[2]
        return clientModrinthV2.getProject(realId)
      }
    }, inject(kSWRVConfig))

  const flights = inject(kFlights, {})

  watch(data, () => {
    const _id = id.value
    const key = getModrinthProjectKey(_id)
    const item = config?.cache.get(key)
    if (item?.data.data.id !== _id) {
      config?.cache.delete(key)
    }
  })
  if (flights.i18nSearch) {
    const { locale } = useI18n()

    const {
      data: iProject,
      isValidating: iRefreshing,
      error: iError,
      mutate: iMutate,
    } = useSWRV(computed(() => getModrinthProjectKey(id.value) + '?locale=' + locale.value),
      () => clientModrinchV2Locale.getProject(id.value), inject(kSWRVConfig))

    const project = computed(() => (!iRefreshing.value ? iProject.value : undefined) ?? data.value)
    const refreshing = computed(() => isValidating.value)
    const refreshError = computed(() => iError.value || error.value)
    const refresh = () => {
      iMutate()
      mutate()
    }

    watch(data, () => {
      const _id = id.value
      const key = getModrinthProjectKey(_id)
      const item = config?.cache.get(key)
      if (item?.data.data.id !== _id) {
        config?.cache.delete(key)
      }
    })
    watch(iProject, () => {
      const _id = id.value
      const key = getModrinthProjectKey(_id) + '?locale=' + locale.value
      const item = config?.cache.get(key)
      if (item?.data.data.id !== _id) {
        config?.cache.delete(key)
      }
    })

    return {
      project,
      isValidating,
      error,
      refresh,
    }
  }

  return {
    project: data,
    isValidating,
    error,
    refresh: mutate,
  }
}

export function getModrinthProjectModel(id: Ref<string>) {
  return {
    key: computed(() => getModrinthProjectKey(id.value)),
    fetcher: async () => clientModrinthV2.getProject(id.value),
  }
}
