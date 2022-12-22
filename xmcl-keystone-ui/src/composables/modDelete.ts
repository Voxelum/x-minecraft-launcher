import { InstanceModsServiceKey, ResourceServiceKey } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { useDialog } from './dialog'
import { ModItem } from './mod'
import { useOperation } from './operation'
import { useService } from './service'

export function useModDeletion(items: Ref<ModItem[]>) {
  const { removeResources } = useService(ResourceServiceKey)
  const { uninstall } = useService(InstanceModsServiceKey)
  const { show } = useDialog('deletion')
  const { begin: beginDelete, cancel: cancelDelete, operate: confirmDelete, data: deletingMods } = useOperation<ModItem[]>([], (mods) => {
    const enabled = mods.filter(m => m.enabled)
    uninstall({ mods: enabled.map(m => m.resource) }).then(() => {
      removeResources(mods.map(m => m.hash))
    })
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
