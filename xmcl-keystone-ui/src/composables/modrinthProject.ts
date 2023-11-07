import { clientModrinthV2, clientModrinchV2Locale } from '@/util/clients'
import useSWRV from 'swrv'
import { Ref } from 'vue'
import { kSWRVConfig } from './swrvConfig'
import { getModrinthProjectKey } from '@/util/modrinth'

export function useModrinthProject(id: Ref<string>) {
  const { locale } = useI18n()
  const config = inject(kSWRVConfig)
  const {
    data: iProject,
    isValidating: iRefreshing,
    error: iError,
    mutate: iMutate,
  } = useSWRV(computed(() => getModrinthProjectKey(id.value) + '?locale=' + locale.value),
    () => clientModrinchV2Locale.getProject(id.value), inject(kSWRVConfig))
  const {
    data,
    isValidating,
    error,
    mutate,
  } = useSWRV(computed(() => getModrinthProjectKey(id.value)),
    async () => clientModrinthV2.getProject(id.value), inject(kSWRVConfig))

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
    refreshing,
    refreshError,
    refresh,
  }
}
