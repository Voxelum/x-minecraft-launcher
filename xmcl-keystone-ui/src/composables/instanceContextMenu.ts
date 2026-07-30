import { BaseServiceKey, InstanceServiceKey, ModGroupData } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { ContextMenuItem } from './contextMenu'
import { useDialog } from './dialog'
import { useService } from './service'
import { injection } from '@/util/inject'
import { kInstance } from './instance'
import { Instance } from '@xmcl/instance'
import { useInjectSidebarSettings } from './sidebarSettings'
import { useInstanceGroupOps } from './instanceGroup'

export function useInstanceContextMenuFunc() {
  const { show: showDeleteDialog } = useDialog('delete-instance')
  const { show: showGroupSelectDialog } = useDialog('mod-group-select')
  const { duplicateInstance } = useService(InstanceServiceKey)
  const { showItemInDirectory } = useService(BaseServiceKey)
  const { t } = useI18n()
  const { path } = injection(kInstance)
  const { currentRoute, push } = useRouter()
  const { pinnedInstances, showOnlyPinned } = useInjectSidebarSettings()
  const { groups, group, createGroup } = useInstanceGroupOps()

  return (inst?: Instance) => {
    if (!inst) return []
    const isPinned = pinnedInstances.value.includes(inst.path)
    const result: ContextMenuItem[] = [
      {
        text: isPinned ? t('sidebar.unpin') : t('sidebar.pin'),
        icon: 'push_pin',
        section: 'sidebar',
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
        section: 'sidebar',
        onClick() {
          showOnlyPinned.value = !showOnlyPinned.value
        },
      },
      {
        text: t('mod.group'),
        icon: 'folder_open',
        section: 'group',
        onClick() {
          const groupRecord: Record<string, ModGroupData> = {}
          const counts: Record<string, number> = {}
          for (const g of groups.value) {
            if (typeof g !== 'string' && g.name) {
              groupRecord[g.name] = { color: g.color, files: [] }
              counts[g.name] = g.instances.length
            }
          }
          showGroupSelectDialog({
            groups: groupRecord,
            groupModCounts: counts,
            countLabel: (count: number) => t('instances.instanceCount', { count }),
            onSelect: (groupName: string | null, newName?: string) => {
              if (groupName) {
                const target = groups.value.find(g => typeof g !== 'string' && g.name === groupName)
                if (target) {
                  group(inst.path, target)
                }
              } else if (newName) {
                createGroup(inst.path, newName)
              }
            },
          })
        },
      },
      {
        text: t('instance.showInstance', { file: inst.path }),
        section: 'action',
        onClick: () => {
          showItemInDirectory(inst.path)
        },
        icon: 'folder',
      },
      {
        text: t('instance.duplicate'),
        icon: 'file_copy',
        section: 'action',
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
        section: 'action',
        onClick() {
          if (path.value !== inst.path) {
            path.value = inst.path
          }
          if (currentRoute.value.fullPath !== '/base-setting') {
            push('/base-setting?changeIcon=true')
          }
        },
      },
      {
        text: t('instance.delete'),
        color: 'red',
        icon: 'delete',
        section: 'danger',
        onClick() {
          showDeleteDialog({ name: inst.name, path: inst.path })
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
