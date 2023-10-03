import { Mod, ModFile } from '@/util/mod'
import { getDiceCoefficient } from '@/util/sort'
import { Mod as CurseforgeMod, Pagination } from '@xmcl/curseforge'
import { SearchResult } from '@xmcl/modrinth'
import { InjectionKey, Ref } from 'vue'

export const kMods: InjectionKey<ReturnType<typeof useMods>> = Symbol('ModSearchItems')

export function useMods(
  keyword: Ref<string>,
  modrinth: Ref<SearchResult | undefined>,
  curseforge: Ref<{ data: CurseforgeMod[]; pagination: Pagination } | undefined>,
  localMods: Ref<ModFile[]>,
  instanceMods: Ref<ModFile[]>,
) {
  const tab = ref(0)
  const disableModrinth = computed(() => tab.value !== 0 && tab.value !== 3)
  const disableCurseforge = computed(() => tab.value !== 0 && tab.value !== 2)
  const disableLocal = computed(() => tab.value !== 0 && tab.value !== 1)

  const items = computed(() => {
    const all: [Mod, number][] = []
    const modr = modrinth.value
    /**
     * The index map
     * - mod name -> mod
     * - curseforge id -> mod
     * - modrinth id -> mod
     */
    const indices: Record<string, Mod> = {}
    const installed: [Mod, number][] = []

    const getItemForMod = (m: ModFile, instanceFile: boolean) => {
      const name = m.name
      const curseforgeId = m.resource.metadata.curseforge?.projectId
      const modrinthId = m.resource.metadata.modrinth?.projectId

      const lookup = () => {
        let item: Mod | undefined
        if (curseforgeId) {
          item = indices[curseforgeId]
          if (item) return item
        }
        if (modrinthId) {
          item = indices[modrinthId]
          if (item) return item
        }
        return indices[name]
      }

      const item = lookup()

      if (!item) {
        // Create new mod project
        indices[name] = markRaw({
          id: name,
          author: m.authors[0] ?? '',
          icon: m.icon,
          title: name,
          description: m.description,
          forge: m.modLoaders.indexOf('forge') !== -1,
          fabric: m.modLoaders.indexOf('fabric') !== -1,
          quilt: m.modLoaders.indexOf('quilt') !== -1,
          links: m.links,
          license: m.license,
          installed: instanceFile ? [m] : [],
          modrinthProjectId: modrinthId,
          curseforgeProjectId: curseforgeId,
          files: [m],
        })

        if (curseforgeId) indices[curseforgeId] = indices[name]
        if (modrinthId) indices[modrinthId] = indices[name]

        return indices[name]
      }

      // Update metadata
      // If the file is not the same file
      if (!item.files?.find((r) => r.path === m.path || r.resource.ino === m.resource.ino || r.resource.storedPath === m.resource.storedPath)) {
        item.files?.push(m)
        if (m.resource.metadata.forge) item.forge = true
        if (m.resource.metadata.fabric) item.fabric = true
        if (m.resource.metadata.quilt) item.quilt = true
      }
      if (instanceFile) {
        if (!item.installed.find((r) => r.path === m.path || r.resource.ino === m.resource.ino || r.resource.storedPath === m.resource.storedPath)) {
          item.installed.push(m)
          console.log(`Add dupicated ${item.id}`, item)
        }
      }
    }

    for (const i of instanceMods.value) {
      const item = getItemForMod(i, true)
      if (item) {
        installed.push([item, getDiceCoefficient(keyword.value, i.name)])
      } else {
        console.log('Skip for installed ', i)
      }
    }
    installed.sort((a, b) => a[0].title.localeCompare(b[0].title))

    if (modr && !disableModrinth.value) {
      for (const i of modr.hits) {
        if (indices[i.project_id.toString()]) {
          const mod = indices[i.project_id.toString()]
          mod.icon = i.icon_url
          mod.title = i.title
          mod.author = i.author
          mod.description = i.description
          mod.downloadCount = i.downloads
          mod.followerCount = i.follows
          mod.modrinth = i
        } else {
          const mod: Mod = {
            id: i.project_id,
            icon: i.icon_url,
            title: i.title,
            author: i.author,
            description: i.description,
            downloadCount: i.downloads,
            followerCount: i.follows,
            modrinth: i,
            installed: [],
          }
          indices[i.project_id.toString()] = mod
          all.push([mod, getDiceCoefficient(keyword.value, i.title)])
        }
      }
    }
    const cf = curseforge.value
    if (cf && !disableCurseforge.value) {
      for (const i of cf.data) {
        if (indices[i.id.toString()]) {
          const mod = indices[i.id.toString()]
          mod.icon = i.logo?.url ?? mod.icon
          mod.title = i.name
          mod.author = i.authors[0].name ?? mod.author
          mod.description = i.summary ?? mod.description
          mod.downloadCount = i.downloadCount
          mod.followerCount = i.thumbsUpCount
          mod.curseforge = i
        } else {
          const mod: Mod = {
            id: i.id.toString(),
            icon: i.logo?.url ?? '',
            title: i.name,
            author: i.authors[0].name,
            description: i.summary,
            downloadCount: i.downloadCount,
            followerCount: i.thumbsUpCount,
            curseforge: i,
            installed: [],
          }
          indices[i.id.toString()] = mod
          all.push(([mod, getDiceCoefficient(keyword.value, i.name)]))
        }
      }
    }

    if (!disableLocal.value) {
      for (const m of localMods.value) {
        const i = getItemForMod(m, false)
        if (i) {
          all.push([i, getDiceCoefficient(keyword.value, m.name)])
        }
      }
    }

    if (keyword.value) {
      all.sort((a, b) => -a[1] + b[1])
    }

    return [installed.map(v => v[0]), all.map(v => v[0])]
  })

  const installed = computed(() => items.value[0])
  const search = computed(() => items.value[1])

  return { installed, search, tab }
}
