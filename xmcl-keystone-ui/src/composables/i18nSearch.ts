import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients'
import { getCursforgeModLoadersFromString } from '@/util/curseforge'
import { ProjectEntry, ProjectFile } from '@/util/search'
import { Mod } from '@xmcl/curseforge'
import { Project } from '@xmcl/modrinth'
import { ProjectMappingServiceKey } from '@xmcl/runtime-api'
import { SearchModel } from './search'
import { useService } from './service'

export function useI18nSearch<T extends ProjectFile>({
  notRemote: disabled,
  keyword,
  modLoader,
  gameVersion,
}: SearchModel) {
  const { lookupByKeyword } = useService(ProjectMappingServiceKey)

  const projects = ref([] as ProjectEntry<T>[])

  async function doSearch(kw: string) {
    if (disabled.value) {
      projects.value = []
      return
    }
    if (!kw) {
      projects.value = []
      return
    }
    const mappings = await lookupByKeyword(kw)
    const modrinths = mappings.filter(m => m.modrinthId).map(m => m.modrinthId)
    const curseforges = mappings.filter(m => m.curseforgeId).map(m => m.curseforgeId)

    const [modrinthsDict, curseforgeDict] = await Promise.all([
      modrinths.length > 0
        ? clientModrinthV2.getProjects(modrinths).then(p => Object.fromEntries(p.map(i => [i.id, i])), () => ({} as Record<string, Project>))
        : {} as Record<string, Project>,
      curseforges.length > 0
        ? clientCurseforgeV1.getMods(curseforges).then(p => Object.fromEntries(p.map(i => [i.id.toString(), i])), () => ({} as Record<string, Mod>))
        : {} as Record<string, Mod>
    ])

    const result: ProjectEntry<T>[] = mappings.map((m) => {
      let modrinth: Project | undefined = modrinthsDict[m.modrinthId ?? '']
      let curseforge: Mod | undefined = curseforgeDict[m.curseforgeId ?? '']

      let unsupportedModrinth = false
      if (modrinth && modLoader.value && !modrinth.loaders.includes(modLoader.value)) {
        unsupportedModrinth = true
      }
      if (modrinth && !modrinth.game_versions.includes(gameVersion.value)) {
        unsupportedModrinth = true
      }

      let unsupportedCurseforge = false
      if (curseforge && curseforge.latestFilesIndexes) {
        if (!curseforge.latestFilesIndexes.some(l => l.gameVersion === gameVersion.value)) {
          unsupportedCurseforge = true
        }
        const requiredModloaders = getCursforgeModLoadersFromString(modLoader.value)
        if (!requiredModloaders.some(l => curseforge.latestFilesIndexes.some(f => f.modLoader === l))) {
          unsupportedCurseforge = true
        }
      }

      return {
        id: m.name + (m.modrinthId || m.curseforgeId || '').toString(),
        icon: modrinth?.icon_url ?? curseforge?.logo?.thumbnailUrl ?? '',
        title: m.name || curseforge?.name || modrinth?.title,
        localizedTitle: m.name,
        description: m.description,
        localizedDescription: m.description,
        author: curseforge?.authors[0].name ?? '',

        unsupported: unsupportedModrinth || unsupportedCurseforge,

        downloadCount: modrinth?.downloads ?? curseforge?.downloadCount ?? 0,
        followerCount: modrinth?.followers ?? 0,

        installed: [],

        curseforge,
        curseforgeProjectId: m.curseforgeId && curseforge ? m.curseforgeId : undefined,

        modrinthProjectId: m.modrinthId && modrinth ? m.modrinthId : undefined,

        files: [],
      }
    })

    projects.value = result as any
  }

  function effect() {
    watch(keyword, (kw) => {
      doSearch(kw)
    })
  }

  return {
    effect,
    projects,
  }
}
