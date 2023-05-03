import useSWRV from 'swrv'
import { Ref } from 'vue'
import { kSWRVConfig } from './swrvConfig'
import { clientCurseforgeV1 } from '@/util/clients'

export function useCurseforgeChangelog(modId: Ref<number>, fileId: Ref<number | undefined>) {
  const { data: changelog } = useSWRV(
    computed(() => fileId.value ? `/cureforge/${modId.value}/${fileId.value}/changelog` : undefined),
    async () => clientCurseforgeV1.getModFileChangelog(modId.value, fileId.value!),
    inject(kSWRVConfig))
  return {
    changelog,
  }
}
