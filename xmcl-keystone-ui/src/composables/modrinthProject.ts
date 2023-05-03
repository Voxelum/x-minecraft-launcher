import { clientModrinthV2, clientModrinchV2Locale } from '@/util/clients'
import useSWRV from 'swrv'
import { Ref } from 'vue'
import { kSWRVConfig } from './swrvConfig'

export function useModrinthProject(id: Ref<string>) {
  const {
    data: project,
    isValidating: refreshing,
    error: refreshError,
    mutate: refresh,
  } = useSWRV(computed(() => `/modrinth/${id.value}`), async () => {
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

  return {
    project,
    refreshing,
    refreshError,
    refresh,
  }
}
