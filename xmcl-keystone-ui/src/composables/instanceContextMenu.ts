import { BaseServiceKey, InstanceServiceKey } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { ContextMenuItem } from './contextMenu'
import { useDialog } from './dialog'
import { useService } from './service'
import { injection } from '@/util/inject'
import { kInstance } from './instance'
import { Instance } from '@xmcl/instance'
import { useInjectSidebarSettings } from './sidebarSettings'

export function useInstanceContextMenuFunc() {
  const { show: showDeleteDialog } = useDialog('delete-instance')
  const { duplicateInstance } = useService(InstanceServiceKey)
  const { showItemInDirectory } = useService(BaseServiceKey)
  const { t } = useI18n()
  const { path } = injection(kInstance)
  const { currentRoute, push } = useRouter()
  const { pinnedInstances, showOnlyPinned } = useInjectSidebarSettings()

  return (inst?: Instance) => {
    if (!inst) return []
    const isPinned = pinnedInstances.value.includes(inst.path)
    const result: ContextMenuItem[] = [
      {
        text: isPinned ? t('sidebar.unpin') : t('sidebar.pin'),
        icon: 'push_pin',
        onClick() {
          if (isPinned) {
            pinnedInstances.value = pinnedInstances.value.filter(p => p !== inst.path)
          } else {
            pinnedInstances.value = [...pinnedInstances.value, inst.path]
          }
        },
      },
      {
        text: t('setting.sidebarShowOnlyPinned'),
        icon: showOnlyPinned.value ? 'check_box' : 'check_box_outline_blank',
        onClick() {
          showOnlyPinned.value = !showOnlyPinned.value
        },
      },
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
          duplicateInstance(inst.path).then((newPath) => {
            try {
              const grouping = localStorage.getItem('modsGrouping')
              if (!grouping) return
              const parsed = JSON.parse(grouping)
              if (parsed[inst.path]) {
                parsed[newPath] = parsed[inst.path]
                localStorage.setItem('modsGrouping', JSON.stringify(parsed))
              }
            } catch (e) {
              console.error('Failed to parse modsGrouping', e)
            }
          })
        },
      },
      {
        text: t('instance.changeIcon'),
        icon: 'image',
        onClick() {
          if (path.value !== inst.path) {
            path.value = inst.path
          }
          if (currentRoute.fullPath !== '/base-setting') {
            push('/base-setting?changeIcon=true')
          }
        },
      },
    ]
    return result
  }
}

export function useInstanceContextMenuItems(instance: Ref<Instance | undefined>) {
  const f = useInstanceContextMenuFunc()

  return () => {
    const inst = instance.value
    return f(inst)
  }
}
