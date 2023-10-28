import { BaseServiceKey, Instance, InstanceServiceKey } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { ContextMenuItem } from './contextMenu'
import { useDialog } from './dialog'
import { useService } from './service'

export function useInstanceContextMenuItems(instance: Ref<Instance>) {
  const { show: showDeleteDialog } = useDialog('delete-instance')
  const { duplicateInstance } = useService(InstanceServiceKey)
  const { showItemInDirectory } = useService(BaseServiceKey)
  const { t } = useI18n()
  const items = computed(() => {
    const result: ContextMenuItem[] = [
      {
        text: t('instance.showInstance', { file: instance.value.path }),
        onClick: () => {
          showItemInDirectory(instance.value.path)
        },
        icon: 'folder',
      },
      {
        text: t('instance.delete'),
        color: 'red',
        icon: 'delete',
        onClick() {
          showDeleteDialog({ name: instance.value.name, path: instance.value.path })
        },
      },
      {
        text: t('instance.duplicate'),
        icon: 'file_copy',
        onClick() {
          duplicateInstance(instance.value.path)
        },
      },
    ]
    return result
  })

  return items
}
