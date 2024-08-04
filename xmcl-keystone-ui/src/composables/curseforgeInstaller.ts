import { getCursforgeFileModLoaders } from '@/util/curseforge'
import { injection } from '@/util/inject'
import { useInstanceModLoaderDefault } from '@/composables/instanceModLoaderDefault'
import { generateDistinctName } from '@/util/instanceName'
import { isNoModLoader } from '@/util/isNoModloader'
import { resolveModpackInstanceConfig } from '@/util/modpackFilesResolver'
import { ProjectFile } from '@/util/search'
import { File, FileRelationType, HashAlgo, Mod } from '@xmcl/curseforge'
import { CreateInstanceOption, CurseForgeServiceKey, CurseforgeUpstream, getCurseforgeFileUri, InstanceServiceKey, ModpackServiceKey, Resource, ResourceServiceKey, RuntimeVersions } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { kInstanceFiles } from './instanceFiles'
import { kInstanceVersion } from './instanceVersion'
import { kInstanceVersionInstall } from './instanceVersionInstall'
import { kInstances } from './instances'
import { useService } from './service'
import { kJavaContext } from './java'

export const kCurseforgeInstaller: InjectionKey<ReturnType<typeof useCurseforgeInstaller>> = Symbol('curseforgeInstaller')

export function useCurseforgeInstaller(
  path: Ref<string>,
  runtime: Ref<RuntimeVersions>,
  allFiles: Ref<ProjectFile[]>,
  installResource: (resource: Resource[], path?: string) => void,
  uninstallResource: (files: ProjectFile[], path?: string) => void,
  type: 'mc-mods' | 'texture-packs' | 'worlds' | 'modpacks',
) {
  const { getResourcesByUris } = useService(ResourceServiceKey)
  const { installFile } = useService(CurseForgeServiceKey)
  const installDefaultModLoader = useInstanceModLoaderDefault()
  const install = async (v: File, icon?: string) => {
    const inst = path.value
    const resources = await getResourcesByUris([getCurseforgeFileUri(v)])
    if (resources.length > 0) {
      installResource(resources, inst)
    } else {
      const { resource } = await installFile({ file: v, icon, type })
      installResource([resource], inst)
    }
  }

  const installWithDependencies = async (mod: Mod, file: File, installed: ProjectFile[], deps: Array<{
    type: FileRelationType
    file: File
    files: File[]
    project: Mod
  }>) => {
    const _path = path.value
    const _runtime = runtime.value
    const _allFiles = allFiles.value
    if (isNoModLoader(runtime.value)) {
      // forge, fabric, quilt or neoforge
      const loaders = getCursforgeFileModLoaders(file)
      await installDefaultModLoader(_path, _runtime, loaders)
    }

    const toUninstalls = [...installed]
    await Promise.all(deps
      ?.filter((v) => v.type === FileRelationType.RequiredDependency)
      .filter(v => _allFiles.every(m => m.curseforge?.fileId !== v.project.id))
      .map((v) => install(v.file, v.project.logo?.url)) ?? [])
    await install(file, mod.logo.url)
    if (toUninstalls.length > 0) {
      uninstallResource(toUninstalls)
    }
  }

  return {
    installWithDependencies,
    install,
  }
}

export function useCurseforgeInstallModpack(icon: Ref<string | undefined>) {
  const { instances, selectedInstance } = injection(kInstances)
  const { getModpackInstallFiles } = useService(ModpackServiceKey)
  const { createInstance } = useService(InstanceServiceKey)
  const { installFile } = useService(CurseForgeServiceKey)
  const { installFiles } = injection(kInstanceFiles)
  const { getVersionHeader, getResolvedVersion } = injection(kInstanceVersion)
  const { getInstanceLock, getInstallInstruction, handleInstallInstruction } = injection(kInstanceVersionInstall)
  const { all } = injection(kJavaContext)
  const { currentRoute, push } = useRouter()
  const installModpack = async (f: File) => {
    const result = await installFile({ file: f, type: 'modpacks', icon: icon.value })
    const resource = result.resource
    const config = resolveModpackInstanceConfig(resource)

    if (!config) return
    const name = generateDistinctName(config.name, instances.value.map(i => i.name))
    const existed = getVersionHeader(config.runtime, '')
    const options: CreateInstanceOption = {
      ...config,
      name,
    }
    if (existed) {
      options.version = existed.id
    }
    const path = await createInstance(options)

    selectedInstance.value = path
    if (currentRoute.path !== '/') {
      push('/')
    }

    const files = await getModpackInstallFiles(resource.path)
    installFiles(path, files)

    const lock = getInstanceLock(path)
    lock.write(async () => {
      const resolved = existed ? await getResolvedVersion(existed) : undefined
      const instruction = await getInstallInstruction(path, config.runtime, '', resolved, all.value)
      await handleInstallInstruction(instruction)
    })
  }
  return installModpack
}

export function useCurseforgeInstanceResource() {
  const { getResourceByHash, getResourcesByUris } = useService(ResourceServiceKey)
  async function getResourceByUpstream(upstream: CurseforgeUpstream) {
    let resource: Resource | undefined
    if (upstream.sha1) {
      resource = await getResourceByHash(upstream.sha1)
    }
    if (!resource) {
      const arr = await getResourcesByUris([getCurseforgeFileUri({
        modId: upstream.modId,
        id: upstream.fileId,
      })])
      resource = arr[0]
    }
    return resource
  }
  async function getResourceByFile(file: File) {
    let resource: Resource | undefined
    const sha1 = file.hashes.find(f => f.algo === HashAlgo.Sha1)?.value
    if (file && sha1) {
      resource = await getResourceByHash(sha1)
    }
    if (!resource) {
      const arr = await getResourcesByUris([getCurseforgeFileUri(file)])
      resource = arr[0]
    }
    return resource
  }
  return {
    getResourceByUpstream,
    getResourceByFile,
  }
}
