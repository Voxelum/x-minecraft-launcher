import { InstanceModsServiceKey, ResourceServiceKey } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { useDialog } from './dialog'
import { ModItem } from './instanceModItems'
import { useOperation } from './operation'
import { useService } from './service'

export function useModDeletion(instancePath: Ref<string>, items: Ref<ModItem[]>) {
  const { uninstall } = useService(InstanceModsServiceKey)
  const { show } = useDialog('deletion')
  const { begin: beginDelete, cancel: cancelDelete, operate: confirmDelete, data: deletingMods } = useOperation<ModItem[]>([], (mods) => {
    uninstall({ mods: mods.map(m => m.mod.resource), path: instancePath.value })
  })
  function startDelete(item?: ModItem) {
    const toDelete = items.value.filter(i => i.dragged || (i.selected))
    if (toDelete.length > 0) {
      beginDelete(toDelete)
      show()
    } else if (item) {
      beginDelete([item])
      show()
    }
  }
  return {
    deletingMods,
    startDelete,
    confirmDelete,
    cancelDelete,
  }
}
