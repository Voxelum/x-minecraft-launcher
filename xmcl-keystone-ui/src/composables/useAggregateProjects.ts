import { Ref } from 'vue'
import { getDiceCoefficient } from '@/util/sort'
import { ProjectEntry } from '@/util/search'
import { get, MaybeRef } from '@vueuse/core'

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
 * Sort the projects by the keyword. It will also filter the project if the networkOnly is true
 * @param keyword The keyword to search
 * @param items The project items
 * @param mode The mod of the filtering project. 'online' only show the connected (curseforge/modrinth) projects. 'local' only show the installed projects.
 * @returns The sorted and filtered project
 */
export function useProjectsSort<T extends ProjectEntry>(
  keyword: Ref<string>,
  items: Ref<T[]>,
) {
  const filterSorted = computed(() => {
    const filtered = items.value

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

/**
 * Aggregate the modrinth/curseforge/local
 * @param external Project provided by modrinth/curseforge/other
 * @param local Project provieded by local cache
 * @param installedProjects The installed project
 * @returns The aggregated project
 */
export function useAggregateProjects<T extends ProjectEntry>(
  external: Ref<T[]>,
  local: Ref<T[]>,
  installedProjects: Ref<T[]>,
  allLocal: Ref<T[]>,
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

    for (const item of installedProjects.value) {
      insert(item)
      all.push(item)
    }

    const visit = (mod: T) => {
      const existed = get(mod)
      if (existed) {
        assignProject(existed, mod)
        insert(existed)
      } else {
        insert(mod)
        all.push(mod)
      }
    }

    for (const mod of external.value) visit(mod)
    for (const mod of local.value) {
      mod.curseforge = undefined
      mod.modrinth = undefined
      visit(mod)
    }
    for (const mod of allLocal.value) {
      const existed = get(mod)
      if (existed) {
        assignProject(existed, mod)
        insert(existed)
      }
    }
    return all
  })

  return items
}

export function useAggregateProjectsSplitted<T extends ProjectEntry>(
  modrinth: Ref<T[]>,
  curseforge: Ref<T[]>,
  local: Ref<T[]>,
  installedProjects: Ref<T[]>,
) {
  const items = computed(() => {
    const installed: T[] = []
    const notInstalledButCached: T[] = []
    const others: T[] = []
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
      installed.push(item)
    }

    const visit = (mod: T) => {
      if (indices[mod.id]) {
        const other = indices[mod.id]
        assignProject(other, mod)
        insert(other)
      } else {
        insert(mod)
        return true
      }
    }

    for (const mod of local.value) {
      mod.curseforge = undefined
      mod.modrinth = undefined
      if (visit(mod)) {
        notInstalledButCached.push(mod)
      }
    }

    for (const mod of modrinth.value) {
      if (visit(mod)) {
        others.push(mod)
      }
    }
    for (const mod of curseforge.value) {
      if (visit(mod)) {
        others.push(mod)
      }
    }

    return [installed, notInstalledButCached, others]
  })
  const installed = computed(() => items.value[0])
  const notInstalledButCached = computed(() => items.value[1])
  const others = computed(() => items.value[2])

  return {
    installed,
    notInstalledButCached,
    others,
  }
}
