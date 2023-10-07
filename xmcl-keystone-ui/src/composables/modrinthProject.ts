import { clientModrinthV2 } from '@/util/clients'
import useSWRV from 'swrv'
import { Ref } from 'vue'
import { kSWRVConfig } from './swrvConfig'
import { getModrinthProjectKey } from '@/util/modrinth'

export function useModrinthProject(id: Ref<string>) {
  const config = inject(kSWRVConfig)
  const {
    data: project,
    isValidating: refreshing,
    error: refreshError,
    mutate: refresh,
  } = useSWRV(computed(() => getModrinthProjectKey(id.value)), async () => {
    // const localePromise = localeClient.getProject(id.value).then((v) => [v, false] as const)
    const [proj, needWait] = await Promise.race([
      clientModrinthV2.getProject(id.value).then((v) => [v, true] as const),
      // localePromise,
    ])
    if (needWait) {
      // localePromise.then((p) => { refresh(() => p[0]) })
    }
    return proj
  }, inject(kSWRVConfig))

  watch(project, () => {
    const _id = id.value
    const key = getModrinthProjectKey(_id)
    const item = config?.cache.get(key)
    if (item?.data.data.id !== _id) {
      config?.cache.delete(key)
    }
  })

  return {
    project,
    refreshing,
    refreshError,
    refresh,
  }
}
