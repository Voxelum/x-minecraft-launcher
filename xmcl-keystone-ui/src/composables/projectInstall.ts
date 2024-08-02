import { getCurseforgeModLoaderTypeFromRuntime, getCursforgeModLoadersFromString, getModLoaderTypesForFile } from '@/util/curseforge'
import { injection } from '@/util/inject'
import { ProjectEntry } from '@/util/search'
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

export function useProjectInstall(runtime: Ref<RuntimeVersions>, loaders: Ref<string[]>, curseforgeInstaller = injection(kCurseforgeInstaller), modrinthInstaller = injection(kModrinthInstaller)) {
  const config = injection(kSWRVConfig)
  const onInstallProject = async (item: ProjectEntry) => {
    const modrinthProjectId = item.modrinth?.project_id
    const curseforgeId = item.curseforge?.id
    if (modrinthProjectId) {
      const proj = await getSWRV(getModrinthProjectModel(ref(modrinthProjectId)), config)
      if (!proj) {
        // TODO: error
        return
      }
      const gameVersions = [runtime.value.minecraft]
      const versions = await getSWRV(getModrinthVersionModel(ref(modrinthProjectId), undefined, loaders, ref(gameVersions)), config)
      if (!versions) {
        // TODO: error
        return
      }
      const version = versions?.[0]
      const deps = await getSWRV(getModrinthDependenciesModel(ref(version), config), config)
      await modrinthInstaller.installWithDependencies(proj, version, item.installed, deps || [])
    } else if (curseforgeId) {
      const proj = await getSWRV(getCurseforgeProjectModel(ref(curseforgeId)), config)
      if (!proj) { return }
      const _loaders = getCursforgeModLoadersFromString(loaders.value as any)
      const files = await getSWRV(getCurseforgeProjectFilesModel(ref(curseforgeId), ref(runtime.value.minecraft), ref(_loaders[0])), config)
      if (!files) { return }
      const file = files.data[0]
      const loaderType = getModLoaderTypesForFile(file)
      const deps = await getSWRV(getCurseforgeDependenciesModel(ref(file), ref(runtime.value.minecraft), ref([...loaderType][0]), config), config)
      await curseforgeInstaller.installWithDependencies(proj, file, item.installed, deps || [])
    }
  }

  return onInstallProject
}
