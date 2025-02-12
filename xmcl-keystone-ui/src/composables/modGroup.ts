import { ModFile } from '@/util/mod';
import { ProjectEntry, ProjectFile } from '@/util/search';
import { useLocalStorage } from '@vueuse/core';
import { ContextMenuItem } from './contextMenu';

export type ProjectGroup<T extends ProjectFile = ProjectFile> = { name: string; projects: ProjectEntry<T>[]; mtime: number }

export function useModGroups(isLocalView: Ref<boolean>, path: Ref<string>, items: Ref<ProjectEntry<ModFile>[]>, sortBy: Ref<string>) {
  const grouping = useLocalStorage('modsGrouping', ({} as Record<string, Record<string, string>>))
  const instanceModGroupping = computed({
    get: () => grouping.value[path.value] ?? {},
    set: (v) => {
      grouping.value = { ...grouping.value, [path.value]: v }
    }
  })

  const { t } = useI18n()

  type GroupOrProject = ProjectGroup<ModFile> | ProjectEntry<ModFile>
  const groupCollapsedState = ref({} as Record<string, boolean>)

  const groups = computed(() => Array.from(new Set(Object.values(instanceModGroupping.value))))

  function group(fileNames: string[]) {
    const newVal = { ...instanceModGroupping.value }
    const newGroupName = fileNames.join(',')
    for (const f of fileNames) {
      newVal[f] = newGroupName
    }
    instanceModGroupping.value = newVal
  }

  function renameGroup(oldName: string, newName: string) {
    if (oldName === newName) return
    const newVal = { ...instanceModGroupping.value }
    for (const f in newVal) {
      if (newVal[f] === oldName) {
        newVal[f] = newName
      }
    }
    instanceModGroupping.value = newVal
  }

  function sort(result: GroupOrProject[]) {
    const sort = sortBy.value
    if (sort.startsWith('time')) {
      result.sort((a, b) => {
        const aMtime = 'mtime' in a ? a.mtime : a.installed[0]?.mtime
        const bMtime = 'mtime' in b ? b.mtime : b.installed[0]?.mtime
        if (!aMtime || !bMtime) return 0
        if (sort.endsWith('asc')) return aMtime - bMtime
        return bMtime - aMtime
      })
    } else if (sort.startsWith('alpha')) {
      result.sort((a, b) => {
        const aText = 'title' in a ? a.title : a.name
        const bText = 'title' in b ? b.title : b.name

        if (sort.endsWith('asc')) return aText.localeCompare(bText)
        return bText.localeCompare(aText)
      })
    }
    return result
  }

  const localGroupedItems = computed(() => {
    if (!isLocalView.value) return []
    const result = items.value
    const resultByGroup = {} as Record<string, ProjectGroup<ModFile>>
    const ungrouped = [] as ProjectEntry<ModFile>[]
    const currentGroup = instanceModGroupping.value

    for (const i of result) {
      const group = currentGroup[i.installed?.[0].fileName]
      if (group) {
        if (!resultByGroup[group]) {
          resultByGroup[group] = {
            name: group,
            projects: [],
            mtime: 0,
          }
        }
        resultByGroup[group].projects.push(i)
        resultByGroup[group].mtime = Math.max(resultByGroup[group].mtime, i.installed[0].mtime)
      } else {
        ungrouped.push(i)
      }
    }

    const sortableEntity: Array<GroupOrProject> = [
      ...Object.values(resultByGroup),
      ...ungrouped,
    ]

    sort(sortableEntity)

    for (const i of sortableEntity) {
      if ('projects' in i) {
        sort(i.projects)
      }
    }

    return sortableEntity
  })

  function ungroup(groupName: string) {
    const newVal = { ...instanceModGroupping.value }
    for (const f in newVal) {
      if (newVal[f] === groupName) {
        delete newVal[f]
      }
    }
    instanceModGroupping.value = markRaw(newVal)
  }

  function getContextMenuItemsForGroup(proj: ProjectEntry<ModFile>) {
    const fileName = proj.installed?.[0]?.fileName
    if (!fileName) return []
    if (Object.values(instanceModGroupping.value).length === 0) return [{
      icon: 'label',
      text: t('mod.group'),
      onClick: () => {
        group([fileName])
      },
    }]
    
    const result = [{
      icon: 'label',
      text: t('mod.group'),
      onClick: () => {
        group([fileName])
      },
      children: groups.value.map((g) => ({
        text: g,
        onClick: () => {
          const newVal = { ...instanceModGroupping.value }
          newVal[fileName] = g
          instanceModGroupping.value = newVal
        },
      })),
    }] as ContextMenuItem[]

    if (instanceModGroupping.value[fileName]) {
      result.push({
        icon: 'label_off',
        text: t('mod.ungroup'),
        onClick: () => {
          const newVal = { ...instanceModGroupping.value }
          delete newVal[fileName]
          instanceModGroupping.value = newVal
        },
      })
    }

    return result
  }

  return {
    currentGroup: instanceModGroupping,
    groups,
    group,
    ungroup,
    renameGroup,
    localGroupedItems,
    groupCollapsedState,
    getContextMenuItemsForGroup
  }
}