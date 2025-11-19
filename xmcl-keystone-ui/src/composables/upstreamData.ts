import { injection } from '@/util/inject'
import { getCurseforgeProjectModel, useCurseforgeUpstreamHeader } from './curseforge'
import { useModrinthHeaderData } from './modrinth'
import { getModrinthProjectModel } from './modrinthProject'
import { useSWRVModel } from './swrv'
import { kInstance } from './instance'

export function useUpstreamData() {
  const { instance } = injection(kInstance)
  const { data: project } = useSWRVModel(getCurseforgeProjectModel(computed(() => instance.value.upstream?.type === 'curseforge-modpack' ? Number(instance.value.upstream.modId) : undefined)))
  const curseforgeHeaderData = useCurseforgeUpstreamHeader(project)
  const { data: modrinthProject } = useSWRVModel(getModrinthProjectModel(computed(() => instance.value.upstream?.type === 'modrinth-modpack' ? instance.value.upstream.projectId : undefined)))
  const modrinthHeaderData = useModrinthHeaderData(modrinthProject)
  const headerData = computed(() => {
    const val = instance.value.upstream
    if (!val) return undefined
    if (val.type === 'curseforge-modpack') {
      return curseforgeHeaderData.value
    }
    if (val.type === 'modrinth-modpack') {
      return modrinthHeaderData.value
    }
    return undefined
  })
  const galleries = computed(() => {
    const val = instance.value.upstream
    if (!val) return []
    if (val.type === 'curseforge-modpack' && project.value) {
      return project.value.screenshots.map((s) => ({
        url: s.thumbnailUrl,
        title: s.title,
        description: s.description,
        rawUrl: s.url,
      }))
    }
    if (val.type === 'modrinth-modpack' && modrinthProject.value) {
      return modrinthProject.value.gallery.map((g) => ({
        url: g.url,
        rawUrl: g.raw_url,
        title: g.title,
        description: g.description,
      }))
    }
    return []
  })
  return {
    headerData,
    galleries,
  }
}