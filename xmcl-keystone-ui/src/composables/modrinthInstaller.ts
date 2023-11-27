import { useInstanceModLoaderDefault } from '@/util/instanceModLoaderDefault'
import { isNoModLoader } from '@/util/isNoModloader'
import { ProjectFile } from '@/util/search'
import { Project, ProjectVersion } from '@xmcl/modrinth'
import { ModrinthServiceKey, Resource, ResourceServiceKey, RuntimeVersions } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useService } from './service'

export const kModrinthInstaller: InjectionKey<ReturnType<typeof useModrinthInstaller>> = Symbol('modrinthInstaller')

export function useModrinthInstaller(
  path: Ref<string>,
  runtime: Ref<RuntimeVersions>,
  allFiles: Ref<ProjectFile[]>,
  installResource: (resources: Resource[]) => void,
  uninstallFiles: (resources: ProjectFile[]) => void,
) {
  const { installVersion } = useService(ModrinthServiceKey)
  const installDefaultModLoader = useInstanceModLoaderDefault(path, runtime)
  const { getResourcesByUris } = useService(ResourceServiceKey)

  const getResource = async (v: ProjectVersion) => {
    const url = v.files.find(f => f.primary)?.url
    if (url) { return (await getResourcesByUris([url]))[0] }
    return undefined
  }

  const install = async (p: Project, v: ProjectVersion) => {
    const resource = await getResource(v)
    if (resource) {
      installResource([resource])
    } else {
      const { resources } = await installVersion({ version: v, icon: p.icon_url })
      installResource(resources)
    }
  }

  async function installWithDependencies(p: Project, v: ProjectVersion, installed: ProjectFile[], deps: Array<{ recommendedVersion: ProjectVersion; project: Project; type: string }>) {
    if (isNoModLoader(runtime.value)) {
      // forge, fabric, quilt or neoforge
      await installDefaultModLoader(v.loaders)
    }
    const files = [...installed]
    await Promise.all(deps
      ?.filter((v) => v.type === 'required')
      .filter(v => allFiles.value.every(m => m.modrinth?.projectId !== v.project.id))
      .map((v) => install(v.project, v.recommendedVersion)) ?? [])
    await install(p, v)
    if (files.length > 0) {
      uninstallFiles(files)
    }
  }

  return { installWithDependencies, install }
}
