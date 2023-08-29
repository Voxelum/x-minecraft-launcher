import { AsyncState } from '@/util/asyncState'
import { clientModrinthV2 } from '@/util/clients'
import { Project } from '@xmcl/modrinth'
import useSWRV from 'swrv'
import { Ref } from 'vue'
import { kSWRVConfig } from './swrvConfig'

export function useModrinthProject(id: Ref<string>) {
  const config = inject(kSWRVConfig)
  const {
    data: project,
    isValidating: refreshing,
    error: refreshError,
    mutate: refresh,
  } = useSWRV(computed(() => `/modrinth/${id.value}`), async () => {
    console.log(id.value)
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
    const item = config?.cache.get(`/modrinth/${_id}`)
    if (item?.data.data.id !== _id) {
      config?.cache.delete(`/modrinth/${_id}`)
    }
  })

  return {
    project,
    refreshing,
    refreshError,
    refresh,
  }
}
