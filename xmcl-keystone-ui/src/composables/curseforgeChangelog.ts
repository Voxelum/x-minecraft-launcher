import useSWRV from 'swrv'
import { Ref } from 'vue'
import { client } from './curseforge'
import { kSWRVConfig } from './swrvConfig'

export function useCurseforgeChangelog(modId: Ref<number>, fileId: Ref<number | undefined>) {
  const { data: changelog } = useSWRV(
    computed(() => fileId.value ? `/cureforge/${modId.value}/${fileId.value}/changelog` : undefined),
    async () => client.getFileChangelog(modId.value, fileId.value!),
    inject(kSWRVConfig))
  return {
    changelog,
  }
}
