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
        return clientModrinthV2.getProject(id.value)
      } else {
        const realId = key.split('/')[2]
        return clientModrinthV2.getProject(realId)
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

export function getModrinthProjectModel(id: Ref<string>) {
  return {
    key: computed(() => getModrinthProjectKey(id.value)),
    fetcher: async () => clientModrinthV2.getProject(id.value),
  }
}
