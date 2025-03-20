import { injection } from '@/util/inject';
import { kInstanceModsContext } from './instanceMods';
import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients';
import { ModFile } from '@/util/mod';
import { InstanceFile } from '@xmcl/runtime-api';
import { basename } from '@/util/basename';
import { useRefreshable } from './refreshable';

export function useModLibCleaner() {
  const unusedMods = shallowRef([] as InstanceFile[])
  const { mods } = injection(kInstanceModsContext)

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

    console.log(result.map(r => basename(r.path)))

    unusedMods.value = result
  }

  function getModsWithNoDependent(mods: ModFile[]) {
    const modsDict = mods.reduce((dict, m) => {
      dict[m.modId] = m
      return dict
    }, {} as Record<string, ModFile>)

    for (const m of mods) {
      for (const dep of m.dependencies) {
        if (modsDict[dep.modId]) {
          delete modsDict[dep.modId]
        }
      }
    }

    return Object.values(modsDict)
  }

  return {
    unusedMods,
    refresh,
    refreshing,
    error
  }
}