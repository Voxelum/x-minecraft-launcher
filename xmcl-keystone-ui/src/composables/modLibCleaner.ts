import { basename } from '@/util/basename';
import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients';
import { getEnabledModsWithNoDependent, ModFile } from '@/util/mod';
import { useRefreshable } from './refreshable';
import { InstanceInstallDialog } from './instanceUpdate';
import { useDialog } from './dialog';
import { InstanceFile } from '@xmcl/instance';

export const kModLibCleaner: InjectionKey<ReturnType<typeof useModLibCleaner>> = Symbol('mod-lib-cleaner')

export function useModLibCleaner(mods: Ref<ModFile[]>, allowLoaders: Ref<string[]>) {
  const unusedMods = shallowRef([] as InstanceFile[])
  let operationId = ''

  const { refresh, refreshing, error } = useRefreshable(async () => {
    await calcUnusedLibsMod(mods.value)
    operationId = crypto.getRandomValues(new Uint8Array(8)).join('')
  })

  watch(mods, async (mods) => {
    const paths = new Set(mods.map(m => 'mods/' + basename(m.path)))
    unusedMods.value = unusedMods.value.filter(m => paths.has(m.path))
    error.value = undefined
  })

  async function calcUnusedLibsMod(mods: ModFile[]) {
    const orphan = getEnabledModsWithNoDependent(mods, allowLoaders.value)
    const [modrinthMods, curseforgeMods] = orphan.reduce((arr, m) => {
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

  const { show } = useDialog(InstanceInstallDialog)

  function apply() {
    const oldFiles = unusedMods.value
    const newFiles = oldFiles.map(f => ({ ...f, path: f.path + '.disabled' }))
    show({
      type: 'updates',
      oldFiles,
      files: newFiles,
      id: operationId,
    })
  }

  return {
    apply,
    unusedMods,
    refresh,
    refreshing,
    error
  }
}