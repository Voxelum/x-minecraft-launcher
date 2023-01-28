import { CurseForgeServiceKey } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { useRefreshable } from './refreshable'
import { useService } from './service'

export function useCurseforgeChangelog(modId: Ref<number>, fileId: Ref<number | undefined>) {
  const { getFileChangelog } = useService(CurseForgeServiceKey)
  const changelog = ref('')
  const { refresh, refreshing } = useRefreshable(async () => {
    const id = fileId.value
    if (!id) {
      changelog.value = ''
    } else {
      changelog.value = await getFileChangelog({ modId: modId.value, id: id })
    }
  })
  onMounted(refresh)
  watch([modId, fileId], refresh)
  return {
    changelog,
    refresh,
    refreshing,
  }
}
