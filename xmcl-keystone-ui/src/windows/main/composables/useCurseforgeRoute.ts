import { useRouter } from '/@/hooks'
import { ProjectType } from '@xmcl/runtime-api'

export function useCurseforgeRoute() {
  const { push } = useRouter()
  function searchProjectAndRoute(name: string, type: ProjectType) {
    push(`/curseforge/${type}?keyword=${name}`)
  }
  function goProjectAndRoute(projectId: number, type: ProjectType) {
    push(`/curseforge/${type}/${projectId}`)
  }

  return {
    searchProjectAndRoute,
    goProjectAndRoute,
  }
}

export function useMcWikiRoute() {
  const { push } = useRouter()
  function searchProjectAndRoute(name: string) {
    push(`mcwiki?path=https://www.mcmod.cn/s?key=${name}`)
  }
  return {
    searchProjectAndRoute,
  }
}
