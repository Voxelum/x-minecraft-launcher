import { InstanceModsServiceKey } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { useDialog } from './dialog'
import { ModItem } from './mod'
import { useOperation } from './operation'
import { useResourceOperation } from './resource'
import { useService } from './service'

export function useModDeletion(items: Ref<ModItem[]>) {
  const { removeResource } = useResourceOperation()
  const { uninstall } = useService(InstanceModsServiceKey)
  const { show } = useDialog('deletion')
  const { begin: beginDelete, cancel: cancelDelete, operate: confirmDelete, data: deletingMods } = useOperation<ModItem[]>([], (mods) => {
    const enabled = mods.filter(m => m.enabled)
    uninstall({ mods: enabled.map(m => m.resource) }).then(() => {
      for (const mod of mods) {
        removeResource(mod.hash)
      }
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
