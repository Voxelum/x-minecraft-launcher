import { BaseServiceKey, Instance, InstanceServiceKey } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { ContextMenuItem } from './contextMenu'
import { useDialog } from './dialog'
import { useService } from './service'

export function useInstanceContextMenuItems(instance: Ref<Instance | undefined>) {
  const { show: showDeleteDialog } = useDialog('delete-instance')
  const { duplicateInstance } = useService(InstanceServiceKey)
  const { showItemInDirectory } = useService(BaseServiceKey)
  const { t } = useI18n()

  return () => {
    const inst = instance.value
    if (!inst) return []
    const result: ContextMenuItem[] = [
      {
        text: t('instance.showInstance', { file: inst.path }),
        onClick: () => {
          showItemInDirectory(inst.path)
        },
        icon: 'folder',
      },
      {
        text: t('instance.delete'),
        color: 'red',
        icon: 'delete',
        onClick() {
          showDeleteDialog({ name: inst.name, path: inst.path })
        },
      },
      {
        text: t('instance.duplicate'),
        icon: 'file_copy',
        onClick() {
          duplicateInstance(inst.path)
        },
      },
    ]
    return result
  }
}
