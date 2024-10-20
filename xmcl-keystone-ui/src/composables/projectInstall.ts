import { getCursforgeFileModLoaders, getCursforgeModLoadersFromString, getModLoaderTypesForFile } from '@/util/curseforge'
import { injection } from '@/util/inject'
import { ProjectEntry, ProjectFile } from '@/util/search'
import { getSWRV } from '@/util/swrvGet'
import { RuntimeVersions } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { getCurseforgeProjectFilesModel, getCurseforgeProjectModel } from './curseforge'
import { getCurseforgeDependenciesModel } from './curseforgeDependencies'
import { kCurseforgeInstaller } from './curseforgeInstaller'
import { getModrinthDependenciesModel } from './modrinthDependencies'
import { kModrinthInstaller } from './modrinthInstaller'
import { getModrinthProjectModel } from './modrinthProject'
import { getModrinthVersionModel } from './modrinthVersions'
import { kSWRVConfig } from './swrvConfig'
import { useNotifier } from './notifier'

/**
 * Provide default install for the project
 */
export function useProjectInstall(runtime: Ref<RuntimeVersions>, loaders: Ref<string[]>,
  curseforgeInstaller = injection(kCurseforgeInstaller),
  modrinthInstaller = injection(kModrinthInstaller),
  installLocal: (item: ProjectFile) => void,
) {
  const config = injection(kSWRVConfig)
  const { notify } = useNotifier()
  const onInstallProject = async (item: ProjectEntry) => {
    const modrinthProjectId = item.modrinth?.project_id
    const curseforgeId = item.curseforge?.id
    if (modrinthProjectId) {
      const proj = await getSWRV(getModrinthProjectModel(ref(modrinthProjectId)), config)
      if (!proj) {
        notify({
          level: 'error',
          title: 'Failed to get modrinth project',
        })
        return
      }
      const gameVersions = [runtime.value.minecraft]
      const versions = await getSWRV(getModrinthVersionModel(ref(modrinthProjectId), undefined, loaders, ref(gameVersions)), config)
      if (!versions) {
        notify({
          level: 'error',
          title: 'Failed to get modrinth versions',
        })
        return
      }
      const version = versions?.[0]
      const deps = await getSWRV(getModrinthDependenciesModel(ref(version), config), config)
      await modrinthInstaller.installWithDependencies(version.id, version.loaders, proj.icon_url, item.installed, deps || [])
    } else if (curseforgeId) {
      const proj = await getSWRV(getCurseforgeProjectModel(ref(curseforgeId)), config)
      if (!proj) {
        notify({
          level: 'error',
          title: 'Failed to get curseforge project',
        })
        return
      }
      const _loaders = getCursforgeModLoadersFromString(loaders.value as any)
      const files = await getSWRV(getCurseforgeProjectFilesModel(ref(curseforgeId), ref(runtime.value.minecraft), ref(_loaders[0])), config)
      if (!files) {
        notify({
          level: 'error',
          title: 'Failed to get curseforge files',
        })
        return
      }
      const file = files.data[0]
      const loaderType = getModLoaderTypesForFile(file)
      const deps = await getSWRV(getCurseforgeDependenciesModel(ref(file), ref(runtime.value.minecraft), ref([...loaderType][0]), config), config)
      await curseforgeInstaller.installWithDependencies(file.id, getCursforgeFileModLoaders(file), proj.logo.url, item.installed, deps || [])
    } else if (item.files) {
      const file = item.files[0]
      if (!file) {
        notify({
          level: 'error',
          title: 'Failed to get project file',
        })
        return
      }
      installLocal(file)
    }
  }

  return onInstallProject
}
