import { injection } from '@/util/inject';
import { kInstanceModsContext } from './instanceMods';
import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients';
import { ModFile } from '@/util/mod';
import { InstanceFile } from '@xmcl/runtime-api';
import { basename } from '@/util/basename';
import { useRefreshable } from './refreshable';

export function useModLibCleaner() {
  const unusedMods = shallowRef([] as InstanceFile[])
  const { mods, allowLoaders } = injection(kInstanceModsContext)

  const { refresh, refreshing, error } = useRefreshable(async () => {
    await calcUnusedLibsMod(mods.value)
  })

  async function calcUnusedLibsMod(mods: ModFile[]) {
    const [modrinthMods, curseforgeMods] = mods.reduce((arr, m) => {
      if (m.modrinth) arr[0].push(m)
      else if (m.curseforge) arr[1].push(m)
      return arr
    }, [[] as ModFile[], [] as ModFile[]])

    const omit = new Set<string | number>()

    if (modrinthMods.length > 0) {
      const modrinthProjects = await clientModrinthV2.getProjects(modrinthMods.map(m => m.modrinth!.projectId))
      for (const p of modrinthProjects) {
        if (p.categories.includes('library')) {
          omit.add(p.id)
        }
      }
    }

    if (curseforgeMods.length > 0) {
      const curseforgeProjects = await clientCurseforgeV1.getMods(curseforgeMods.map(m => m.curseforge!.projectId))
      for (const p of curseforgeProjects) {
        if (p.categories.some(c => c.id === 421 || c.id === 6945)) {
          omit.add(p.id)
        }
      }
    }

    const orphan = getModsWithNoDependent(mods)

    const result = orphan.filter(m => {
      const key = m.modrinth?.projectId ?? m.curseforge?.projectId
      if (!key) return false
      return omit.has(key)
    }).map(m => {
      const file: InstanceFile = markRaw({
        path: `mods/${basename(m.path)}`,
        hashes: { sha1: m.hash },
      })
      return file
    })

    unusedMods.value = result
  }

  function getModsWithNoDependent(mods: ModFile[]) {
    const modsDict = mods.reduce((dict, m) => {
      dict[m.modId] = m
      for (const alias of Object.keys(m.provideRuntime)) {
        dict[alias] = m
      }
      return dict
    }, {} as Record<string, ModFile>)

    const omitted = new Set<ModFile>()
    for (const m of mods) {
      for (const loader of allowLoaders.value) {
        const deps = m.dependencies[loader] || []
        for (const dep of deps) {
          if (modsDict[dep.modId]) {
            const mod = modsDict[dep.modId]
            omitted.add(mod)
          }
        }
      }
    }

    return mods.filter(m => !omitted.has(m))
  }

  return {
    unusedMods,
    refresh,
    refreshing,
    error
  }
}