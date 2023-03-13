import { getDiceCoefficient } from '@/util/sort'
import { Mod, Pagination } from '@xmcl/curseforge'
import { SearchResult, SearchResultHit } from '@xmcl/modrinth'
import { Resource } from '@xmcl/runtime-api'
import { Ref } from 'vue'

export interface ModListSearchItem {
  id: string
  icon: string
  title: string
  description: string

  forge?: boolean
  fabric?: boolean
  quilt?: boolean

  curseforge?: Mod
  modrinth?: SearchResultHit
  resource?: Resource[]
}

export function useModSearchItems(keyword: Ref<string>, modrinth: Ref<SearchResult | undefined>, curseforge: Ref<{
  data: Mod[]
  pagination: Pagination
} | undefined>, mods: Ref<Resource[]>) {
  const tab = ref(0)
  const disableModrinth = computed(() => tab.value !== 0 && tab.value !== 3)
  const disableCurseforge = computed(() => tab.value !== 0 && tab.value !== 2)
  const disableLocal = computed(() => tab.value !== 0 && tab.value !== 1)

  const items = computed(() => {
    const results: [ModListSearchItem, number][] = []
    const modr = modrinth.value
    if (modr && !disableModrinth.value) {
      for (const i of modr.hits) {
        results.push([{
          id: i.project_id,
          icon: i.icon_url,
          title: i.title,
          description: i.description,
          modrinth: i,
        }, getDiceCoefficient(keyword.value, i.title)])
      }
    }
    const cf = curseforge.value
    if (cf && !disableCurseforge.value) {
      for (const i of cf.data) {
        results.push(([{
          id: i.id.toString(),
          icon: i.logo.url,
          title: i.name,
          description: i.summary,
          curseforge: i,
        }, getDiceCoefficient(keyword.value, i.name)]))
      }
    }
    if (!disableLocal.value) {
      const dict: Record<string, ModListSearchItem> = {}
      for (const m of mods.value) {
        let description = ''
        let name = ''
        if (m.metadata.forge) {
          description = m.metadata.forge.description
          name = m.metadata.forge.name
        } else if (m.metadata.fabric) {
          if (m.metadata.fabric instanceof Array) {
            description = m.metadata.fabric[0].description || ''
            name = m.metadata.fabric[0].name || m.metadata.fabric[0].id || ''
          } else {
            description = m.metadata.fabric.description || ''
            name = m.metadata.fabric.name || m.metadata.fabric.id || ''
          }
        }
        if (!dict[name]) {
          dict[name] = {
            id: m.path,
            icon: m.icons?.[0] ?? '',
            title: name,
            description: description,
            forge: m.metadata.forge !== undefined,
            fabric: m.metadata.fabric !== undefined,
            quilt: m.metadata.quilt !== undefined,
            resource: [m],
          }
          results.push(([dict[name], getDiceCoefficient(keyword.value, m.name)]))
        } else {
          dict[name].resource?.push(m)
          if (m.metadata.forge) dict[name].forge = true
          if (m.metadata.fabric) dict[name].fabric = true
          if (m.metadata.quilt) dict[name].quilt = true
        }
      }
    }

    results.sort((a, b) => -a[1] + b[1])
    return results.map(v => v[0])
  })

  return { items, tab }
}
