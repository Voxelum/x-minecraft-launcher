import { Ref } from 'vue'
import { getDiceCoefficient } from '@/util/sort'
import { ProjectEntry } from '@/util/search'

function assignProject(a: ProjectEntry, b: ProjectEntry) {
  a.icon = b.icon || a.icon
  a.title = b.title || a.title
  a.author = b.author || a.author
  a.description = b.description || a.description
  a.downloadCount = b.downloadCount || a.downloadCount
  a.followerCount = b.followerCount || a.followerCount
  a.modrinth = b.modrinth || a.modrinth
  a.curseforge = b.curseforge || a.curseforge
}

export function useProjectsFilterSearch<T extends ProjectEntry>(
  keyword: Ref<string>,
  items: Ref<T[]>,
  networkOnly: Ref<boolean>,
  isCurseforgeActive: Ref<boolean>,
  isModrinthActive: Ref<boolean>,
) {
  const filterSorted = computed(() => {
    const filtered = networkOnly.value
      ? items.value.filter(p => {
        if (!isCurseforgeActive.value && p.curseforge) return false
        if (!isModrinthActive.value && p.modrinth) return false
        return p.curseforge || p.modrinth || p.id === 'OptiFine'
      })
      : items.value

    if (!keyword.value) return filtered

    return filtered
      .map(p => [p, getDiceCoefficient(keyword.value, p.title)] as const)
      // .filter(p => p[1] > 0)
      .sort((a, b) => -a[1] + b[1])
      .map(p => p[0])
  })
  return filterSorted
}

export function useAggregateProjects<T extends ProjectEntry>(
  modrinth: Ref<T[]>,
  curseforge: Ref<T[]>,
  cached: Ref<T[]>,
  installedProjects: Ref<T[]>,
) {
  const items = computed(() => {
    const all: T[] = []
    /**
     * The index map
     * - mod name -> project
     * - curseforge id -> project
     * - modrinth id -> project
     */
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

    for (const item of installedProjects.value) {
      insert(item)
      all.push(item)
    }

    const visit = (mod: T) => {
      if (indices[mod.id]) {
        const other = indices[mod.id]
        assignProject(other, mod)
        insert(other)
      } else {
        insert(mod)
        all.push(mod)
      }
    }

    for (const mod of modrinth.value) visit(mod)
    for (const mod of curseforge.value) visit(mod)
    for (const mod of cached.value) {
      mod.curseforge = undefined
      mod.modrinth = undefined
      visit(mod)
    }

    return all
  })

  return items
}
