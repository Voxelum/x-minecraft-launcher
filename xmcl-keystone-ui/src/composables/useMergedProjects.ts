import { ProjectEntry } from '@/util/search'
import { getDiceCoefficient } from '@/util/sort'
import { Ref } from 'vue'

function assignProject(a: ProjectEntry, b: ProjectEntry) {
  a.icon = b.icon || a.icon
  a.title = b.title || a.title
  a.author = b.author || a.author
  a.description = b.description || a.description
  a.downloadCount = b.downloadCount || a.downloadCount
  a.followerCount = b.followerCount || a.followerCount
  a.modrinth = b.modrinth || a.modrinth
  a.curseforge = b.curseforge || a.curseforge
  const filesRecord = Object.fromEntries((a.files || []).map(f => [f.path, f]))
  for (const file of b.files || []) {
    filesRecord[file.path] = file
  }
  a.files = Object.values(filesRecord)

  const installedRecord = Object.fromEntries((a.installed || []).map(f => [f.path, f]))
  for (const file of b.installed || []) {
    installedRecord[file.path] = file
  }
  a.installed = Object.values(installedRecord)

  a.curseforgeProjectId = a.curseforgeProjectId || b.curseforgeProjectId
  a.modrinthProjectId = a.modrinthProjectId || b.modrinthProjectId
}

/**
 * Sort the projects by keyword relevance when in local/favorite view.
 * For remote view, returns items as-is since the search APIs already handle sorting.
 * @param keyword The keyword to search
 * @param items The project items
 * @param currentView The current view mode ('local', 'favorite', or 'remote')
 * @returns The sorted (for local/favorite) or original (for remote) project items
 */
export function useProjectsSort<T extends ProjectEntry>(
  keyword: Ref<string>,
  items: Ref<T[]>,
  currentView: Ref<'local' | 'favorite' | 'remote'>,
) {
  const filterSorted = computed(() => {
    const filtered = items.value

    // For remote view, return items as-is since API already handles sorting
    if (currentView.value === 'remote') {
      return filtered
    }

    // For local/favorite views, apply keyword-based relevance sorting
    if (!keyword.value) return filtered

    const result = filtered
      .map(p => [p, getDiceCoefficient(keyword.value, p.title)] as const)
      .sort((a, b) => -a[1] + b[1])
      .map(p => p[0])

    return result
  })
  return filterSorted
}

export function useMergedProjects<T extends ProjectEntry>(
  items: Ref<[T[], T[]]>,
) {
  const result = computed(() => {
    const all: T[] = []
    const indices: Record<string, T> = {}
    const insert = (mod: T) => {
      indices[mod.id] = mod
      if (mod.curseforgeProjectId) {
        indices[mod.curseforgeProjectId] = mod
      }
      if (mod.modrinthProjectId) {
        indices[mod.modrinthProjectId] = mod
      }
    }
    const get = (mod: T) => {
      if (indices[mod.id]) {
        return indices[mod.id]
      }
      if (mod.curseforgeProjectId) {
        return indices[mod.curseforgeProjectId]
      }
      if (mod.modrinthProjectId) {
        return indices[mod.modrinthProjectId]
      }
      return undefined
    }

    const visit = (mod: T, addToList: boolean) => {
      const existed = get(mod)
      if (existed) {
        assignProject(existed, mod)
        insert(existed)
      } else {
        mod = { ...mod }
        insert(mod)
        if (addToList) {
          all.push(mod)
        }
      }
    }

    const [source, decorators] = items.value

    for (const item of source) {
      visit(item, true)
    }
    for (const mod of decorators) {
      visit(mod, false)
    }

    return all
  })

  return result
}
