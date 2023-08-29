import useSWRV from 'swrv'
import { Ref } from 'vue'
import { kSWRVConfig } from './swrvConfig'
import { clientCurseforgeV1 } from '@/util/clients'

export function useCurseforgeChangelog(modId: Ref<number>, fileId: Ref<number | undefined>) {
  const { data: changelog, ...rest } = useSWRV(
    computed(() => fileId.value ? `/cureforge/${modId.value}/${fileId.value}/changelog` : undefined),
    async () => {
      const changelog = await clientCurseforgeV1.getModFileChangelog(modId.value, fileId.value!)
      const root = document.createElement('div')
      root.innerHTML = changelog
      const allLinks = root.getElementsByTagName('a')
      for (const link of allLinks) {
        if (link.href) {
          const parsed = new URL(link.href)
          const remoteUrl = parsed.searchParams.get('remoteUrl')
          if (remoteUrl) {
            link.href = decodeURIComponent(remoteUrl)
          }
        }
      }
      return root.innerHTML
    },
    { ...inject(kSWRVConfig), dedupingInterval: Infinity })
  return {
    changelog,
    ...rest,
  }
}
