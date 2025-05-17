import { clientModrinthV2 } from '@/util/clients'
import { getModrinthProjectKey } from '@/util/modrinth'
import useSWRV from 'swrv'
import { Ref } from 'vue'
import { kSWRVConfig } from './swrvConfig'

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
        return clientModrinthV2.getProject(id.value).then(markRaw)
      } else {
        const realId = key.split('/')[2]
        return clientModrinthV2.getProject(realId).then(markRaw)
      }
    }, inject(kSWRVConfig))

  watch(data, () => {
    const _id = id.value
    const key = getModrinthProjectKey(_id)
    const item = config?.cache.get(key)
    if (item?.data.data.id !== _id) {
      config?.cache.delete(key)
    }
  })

  return {
    project: data,
    isValidating,
    error,
    refresh: mutate,
  }
}

export function getModrinthProjectModel(id: Ref<string | undefined>) {
  return {
    key: computed(() => id.value ? getModrinthProjectKey(id.value) : undefined),
    fetcher: async () => !id.value ? undefined : clientModrinthV2.getProject(id.value),
  }
}
