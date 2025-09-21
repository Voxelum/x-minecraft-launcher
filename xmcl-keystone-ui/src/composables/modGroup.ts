import { sort as sortFunc } from '@/composables/sortBy';
import { ModFile } from '@/util/mod';
import { ProjectEntry, ProjectFile } from '@/util/search';
import { InstanceModsGroupServiceKey, InstanceModsGroupState, ModGroupData } from '@xmcl/runtime-api';
import { ContextMenuItem } from './contextMenu';
import { useService } from './service';
import { useState } from './syncableState';
import { Ref, computed, ref, shallowRef, watch, onMounted, markRaw } from 'vue';

export type ProjectGroup<T extends ProjectFile = ProjectFile> = { name: string; projects: ProjectEntry<T>[]; mtime: number }

export function useModGroups(isLocalView: Ref<boolean>, path: Ref<string>, items: Ref<ProjectEntry<ModFile>[]>, sortBy: Ref<string>) {
  const { getGroupState, updateModsGroups, getSharedGroupRules, updateSharedGroupRules } = useService(InstanceModsGroupServiceKey)
  const { state } = useState(() => getGroupState(path.value), InstanceModsGroupState)

  onMounted(() => {
    const cache = localStorage.getItem('modsGrouping')
    if (cache) {
      const parsed = JSON.parse(cache) as Record<string, Record<string, string>>
      for (const [path, fileToGroup] of Object.entries(parsed)) {
        const result = {} as Record<string, ModGroupData>
        for (const [file, group] of Object.entries(fileToGroup)) {
          if (!result[group]) {
            result[group] = { color: '', files: [] }
          }
          result[group].files.push(file)
        }
        updateModsGroups(path, result)
      }
      localStorage.removeItem('modsGrouping')
    }
  })

  const instanceModGroupping = computed({
    get: () => state.value?.groups ?? {},
    set: (v) => {
      updateModsGroups(path.value, v)
    }
  })

  const { t } = useI18n()

  type GroupOrProject = ProjectGroup<ModFile> | ProjectEntry<ModFile>
  
  // Persistent group collapsed state using localStorage with instance path as key
  const getStorageKey = () => `modGroupsCollapsed:${path.value}`
  const loadCollapsedState = (): Record<string, boolean> => {
    try {
      const stored = localStorage.getItem(getStorageKey())
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  }
  
  const groupCollapsedState = shallowRef(loadCollapsedState())
  
  // Watch for changes and persist to localStorage
  watch(groupCollapsedState, (newState) => {
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(newState))
    } catch (error) {
      console.warn('Failed to save group collapsed state:', error)
    }
  })
  
  // Watch for path changes and reload state for new instance
  watch(path, () => {
    groupCollapsedState.value = loadCollapsedState()
  })

  // Helper function to normalize file names by removing .disabled suffix
  function normalizeFileName(fileName: string): string {
    return fileName.endsWith('.disabled') ? fileName.slice(0, -9) : fileName
  }

  const groupNames = computed(() => Object.keys(instanceModGroupping.value))

  function group(fileNames: string[]) {
    const newVal = { ...instanceModGroupping.value }
    const normalizedFileNames = fileNames.map(normalizeFileName)
    const newGroupName = normalizedFileNames.join(',')
    newVal[newGroupName] = {
      files: normalizedFileNames,
      color: '',
    }
    instanceModGroupping.value = newVal
    
    // Ensure new groups start collapsed by default
    if (!(newGroupName in groupCollapsedState.value)) {
      groupCollapsedState.value = { 
        ...groupCollapsedState.value, 
        [newGroupName]: true // true means collapsed
      }
    }
  }

  function renameGroup(oldName: string, newName: string) {
    if (oldName === newName) return
    const newVal = { ...instanceModGroupping.value }
    const group = newVal[oldName]
    if (!group) return
    delete newVal[oldName]
    newVal[newName] = group
    instanceModGroupping.value = newVal
    
    // Preserve collapsed state when renaming
    const collapsedState = groupCollapsedState.value[oldName]
    if (collapsedState !== undefined) {
      const newCollapsedState = { ...groupCollapsedState.value }
      delete newCollapsedState[oldName]
      newCollapsedState[newName] = collapsedState
      groupCollapsedState.value = newCollapsedState
    }
  }

  function sort(result: GroupOrProject[]) {
    // Separate groups from individual items
    const groups = result.filter(item => 'projects' in item) as ProjectGroup<ModFile>[]
    const individuals = result.filter(item => !('projects' in item)) as ProjectEntry<ModFile>[]
    
    // Always sort groups by name first (alphabetical with numeric sorting)
    groups.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
    
    // Apply user-selected sorting to individual items
    sortFunc(sortBy.value as any, individuals)
    
    // Return groups first, then individual items
    result.length = 0
    result.push(...groups, ...individuals)
    return result
  }

  const groupMap = computed(() => {
    const groupMap = {} as Record<string, string>
    const currentGroup = instanceModGroupping.value
    for (const [groupName, group] of Object.entries(currentGroup)) {
      for (const file of group.files) {
        // Map both original and normalized file names to handle disabled mods
        groupMap[file] = groupName
        const normalized = normalizeFileName(file)
        if (normalized !== file) {
          groupMap[normalized] = groupName
        }
      }
    }
    return groupMap
  })

  const localGroupedItems = computed(() => {
    if (!isLocalView.value) return []
    const result = items.value
    const resultByGroup = {} as Record<string, ProjectGroup<ModFile>>
    const ungrouped = [] as ProjectEntry<ModFile>[]
    const _groupMap = groupMap.value

    for (const i of result) {
      const fileName = i.installed?.[0]?.fileName
      if (!fileName) continue
      
      // Use normalized file name for group lookup to handle disabled mods
      const normalizedFileName = normalizeFileName(fileName)
      const group = _groupMap[normalizedFileName]
      
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
    const group = newVal[groupName]
    if (!group) return
    delete newVal[groupName]
    instanceModGroupping.value = markRaw(newVal)
    
    // Clean up collapsed state when group is removed
    if (groupName in groupCollapsedState.value) {
      const newCollapsedState = { ...groupCollapsedState.value }
      delete newCollapsedState[groupName]
      groupCollapsedState.value = newCollapsedState
    }
  }

  function getContextMenuItemsForGroup(proj: ProjectEntry<ModFile>) {
    const fileName = proj.installed?.[0]?.fileName
    if (!fileName) return []

    const result = [] as ContextMenuItem[]

    result.push({
      icon: 'bookmarks',
      text: t('mod.applyGroupRules'),
      onClick: () => {
        applySharedGroupRules()
      },
    }, {
      icon: 'book',
      text: t('mod.syncGroupRules'),
      onClick: () => {
        syncGroupRules()
      },
    })

    if (Object.values(instanceModGroupping.value).length === 0) {
      result.push({
        icon: 'label',
        text: t('mod.group'),
        onClick: () => {
          group([fileName])
        },
      })
      return result
    }

    result.push({
      icon: 'label',
      text: t('mod.group'),
      onClick: () => {
        group([normalizeFileName(fileName)])
      },
      children: groupNames.value.map((g) => ({
        text: g,
        icon: '',
        onClick: () => {
          const newVal = { ...instanceModGroupping.value }
          const normalizedFileName = normalizeFileName(fileName)
          for (const group of Object.values(newVal)) {
            group.files = group.files.filter((f) => normalizeFileName(f) !== normalizedFileName)
          }
          const group = newVal[g]
          group.files.push(normalizedFileName)
          instanceModGroupping.value = newVal
        },
      })),
    })

    if (isInGroup(fileName)) {
      result.push({
        icon: 'label_off',
        text: t('mod.ungroup'),
        onClick: () => {
          const newVal = { ...instanceModGroupping.value }
          const normalizedFileName = normalizeFileName(fileName)
          // Remove from all groups using normalized filename
          for (const group of Object.values(newVal)) {
            group.files = group.files.filter((f) => normalizeFileName(f) !== normalizedFileName)
          }
          instanceModGroupping.value = newVal
        },
      })
    }

    return result
  }

  function isInGroup(fileName?: string) {
    if (!fileName) return false
    return groupMap.value[normalizeFileName(fileName)] !== undefined
  }

  function getGroupColor(fileName?: string) {
    if (!fileName) return ''
    const groupName = groupMap.value[normalizeFileName(fileName)]
    if (!groupName) return ''
    const group = instanceModGroupping.value[groupName]
    if (!group) return ''
    return group.color
  }

  async function syncGroupRules() {
    const rules = await getSharedGroupRules()

    const currentRules = {} as Record<string, string[]>
    const result = items.value
    for (const mod of result) {
      const file = mod.installed?.[0]
      if (!file) continue
      const fileName = file.fileName
      const normalizedFileName = normalizeFileName(fileName)
      const group = groupMap.value[normalizedFileName]
      if (group) {
        if (!currentRules[group]) {
          currentRules[group] = []
        }
        currentRules[group].push(file.modId)
      }
    }

    // merge rules
    for (const [groupName, group] of Object.entries(currentRules)) {
      if (!rules[groupName]) {
        rules[groupName] = []
      }
      // merge with dedup
      rules[groupName] = [...new Set([...rules[groupName], ...group])]
    }

    // update shared group rules
    await updateSharedGroupRules(rules)
  }

  async function applySharedGroupRules() {
    const rules = await getSharedGroupRules()
    const newVal = { ...instanceModGroupping.value }
    const newlyCreatedGroups: string[] = []

    const modIdToGroup = {} as Record<string, string>
    for (const [groupName, group] of Object.entries(rules)) {
      for (const modId of group) {
        modIdToGroup[modId] = groupName
      }
    }

    for (const i of items.value) {
      const file = i.installed?.[0]
      if (!file) continue
      const modId = file.modId
      const fileName = file.fileName
      const normalizedFileName = normalizeFileName(fileName)
      const expectedGroup = modIdToGroup[modId]
      
      if (expectedGroup) {
        if (!newVal[expectedGroup]) {
          newVal[expectedGroup] = {
            files: [],
            color: '',
          }
          newlyCreatedGroups.push(expectedGroup)
        }
        const group = newVal[expectedGroup]
        // Store the normalized filename to handle disabled mods properly
        if (!group.files.includes(normalizedFileName)) {
          group.files.push(normalizedFileName)
        }
      } else {
        // Remove from all groups using normalized filename
        for (const group of Object.values(newVal)) {
          group.files = group.files.filter((f) => normalizeFileName(f) !== normalizedFileName)
        }
      }
    }

    instanceModGroupping.value = newVal
    
    // Ensure newly created groups from rules start collapsed
    if (newlyCreatedGroups.length > 0) {
      const newCollapsedState = { ...groupCollapsedState.value }
      for (const groupName of newlyCreatedGroups) {
        if (!(groupName in newCollapsedState)) {
          newCollapsedState[groupName] = true // true means collapsed
        }
      }
      groupCollapsedState.value = newCollapsedState
    }
  }

  return {
    isInGroup,
    groups: groupNames,
    syncGroupRules,
    applySharedGroupRules,
    getGroupColor,
    group,
    ungroup,
    renameGroup,
    localGroupedItems,
    groupCollapsedState,
    getContextMenuItemsForGroup
  }
}