import { client, localeClient } from '@/util/modrinthClients'
import useSWRV from 'swrv'
import { Ref } from 'vue'

export function useModrinthProject(id: Ref<string>) {
  const {
    data: project,
    isValidating: refreshing,
    error: refreshError,
    mutate: refresh,
  } = useSWRV(computed(() => `/modrinth/${id.value}`), async () => {
    // const localePromise = localeClient.getProject(id.value).then((v) => [v, false] as const)
    const [proj, needWait] = await Promise.race([
      client.getProject(id.value).then((v) => [v, true] as const),
      // localePromise,
    ])
    if (needWait) {
      // localePromise.then((p) => { refresh(() => p[0]) })
    }
    return proj
  })

  return {
    project,
    refreshing,
    refreshError,
    refresh,
  }
}
