import { Mod } from '@/util/mod'
import { getDiceCoefficient } from '@/util/sort'
import { InjectionKey, Ref } from 'vue'

export const kMods: InjectionKey<ReturnType<typeof useMods>> = Symbol('ModSearchItems')

export function useMods(
  keyword: Ref<string>,
  modrinth: Ref<Mod[]>,
  curseforge: Ref<Mod[]>,
  cachedMods: Ref<Mod[]>,
  instanceMods: Ref<Mod[]>,
) {
  const tab = ref(0)
  const disableModrinth = computed(() => tab.value !== 0 && tab.value !== 3)
  const disableCurseforge = computed(() => tab.value !== 0 && tab.value !== 2)
  const disableLocal = computed(() => tab.value !== 0 && tab.value !== 1)

  const assignMod = (a: Mod, b: Mod) => {
    a.icon = b.icon || a.icon
    a.title = b.title || a.title
    a.author = b.author || a.author
    a.description = b.description || a.description
    a.downloadCount = b.downloadCount || a.downloadCount
    a.followerCount = b.followerCount || a.followerCount
    a.modrinth = b.modrinth || a.modrinth
    a.curseforge = b.curseforge || a.curseforge
  }

  const compareMod = (a: Mod, b: Mod) => {
    const builtInOrder = ['minecraft', 'optifine', 'fabric', 'forge', 'liteloader']
    const aBuiltIn = builtInOrder.indexOf(a.id)
    const bBuiltIn = builtInOrder.indexOf(b.id)
    // built-in mods always on the prior of the list
    if (aBuiltIn !== -1 && bBuiltIn !== -1) {
      return aBuiltIn - bBuiltIn
    }
    if (aBuiltIn !== -1) {
      return -1
    }
    if (bBuiltIn !== -1) {
      return 1
    }
    // compare the title
    return a.title.localeCompare(b.title)
  }

  const items = computed(() => {
    const all: [Mod, number][] = []
    /**
     * The index map
     * - mod name -> mod
     * - curseforge id -> mod
     * - modrinth id -> mod
     */
    const indices: Record<string, Mod> = {}
    const installed: [Mod, number][] = []

    for (const item of instanceMods.value) {
      indices[item.id] = item
      if (item) {
        installed.push([item, getDiceCoefficient(keyword.value, item.title)])
      } else {
        console.log('Skip for installed ', item)
      }
    }
    installed.sort((a, b) => compareMod(a[0], b[0]))

    if (!disableModrinth.value) {
      for (const mod of modrinth.value) {
        if (indices[mod.id]) {
          const other = indices[mod.id]
          assignMod(other, mod)
        } else {
          indices[mod.id] = mod
          all.push([mod, getDiceCoefficient(keyword.value, mod.title)])
        }
      }
    }
    if (!disableCurseforge.value) {
      for (const mod of curseforge.value) {
        if (indices[mod.id]) {
          const other = indices[mod.id]
          assignMod(other, mod)
        } else {
          indices[mod.id] = mod
          all.push(([mod, getDiceCoefficient(keyword.value, mod.title)]))
        }
      }
    }

    if (!disableLocal.value) {
      for (const m of cachedMods.value) {
        all.push([m, getDiceCoefficient(keyword.value, m.title)])
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
