import { getSWRV } from '@/util/swrvGet'
import type { AssetIndexIssue, AssetIssue, JavaVersion, LibraryIssue, MinecraftJarIssue, ResolvedVersion } from '@xmcl/core'
import type { InstallProfileIssueReport } from '@xmcl/installer'
import { DiagnoseServiceKey, InstallServiceKey, Instance, InstanceServiceKey, JavaRecord, JavaServiceKey, ReadWriteLock, RuntimeVersions, ServerVersionHeader, VersionHeader, VersionServiceKey, parseOptifineVersion } from '@xmcl/runtime-api'
import { InjectionKey, Ref, ShallowRef } from 'vue'
import { InstanceResolveVersion } from './instanceVersion'
import { useService } from './service'
import { kSWRVConfig } from './swrvConfig'
import { getForgeVersionsModel, getLabyModManifestModel, getMinecraftVersionsModel, getNeoForgedVersionModel } from './version'

export interface InstanceInstallInstruction {
  instance: string
  runtime: RuntimeVersions
  version: string
  resolvedVersion?: string
  jar?: MinecraftJarIssue
  profile?: InstallProfileIssueReport
  libriares?: LibraryIssue[]
  assets?: AssetIssue[]
  assetIndex?: AssetIndexIssue
  optifine?: {
    minecraft: string
    type: string
    patch: string
  }
  forge?: {
    minecraft: string
    version: string
  }
  java?: JavaVersion
}

export const kInstanceVersionInstall = Symbol('InstanceVersionInstall') as InjectionKey<ReturnType<typeof useInstanceVersionInstallInstruction>>
const kAbort = Symbol('Aborted')

function useInstanceVersionInstall(versions: Ref<VersionHeader[]>, servers: Ref<ServerVersionHeader[]>) {
  const {
    installForge,
    installNeoForged,
    installMinecraft,
    installMinecraftJar,
    installOptifine,
    installFabric,
    installQuilt,
    installLabyModVersion,
  } = useService(InstallServiceKey)
  const { refreshVersion } = useService(VersionServiceKey)

  const cfg = inject(kSWRVConfig)

  async function install(runtime: RuntimeVersions, jar = false) {
    const { minecraft, forge, fabricLoader, quiltLoader, optifine, neoForged, labyMod } = runtime
    const mcVersions = await getSWRV(getMinecraftVersionsModel(), cfg)
    const local = versions.value
    const localMinecraft = local.find(v => v.id === minecraft)
    if (!localMinecraft || jar) {
      const metadata = mcVersions.versions.find(v => v.id === minecraft)!
      await installMinecraft(metadata, 'client')
    } else {
      await refreshVersion(localMinecraft.id)
    }

    let forgeVersion = undefined as undefined | string
    if (forge) {
      const localForge = local.find(v => v.forge === forge && v.minecraft === minecraft)
      if (!localForge) {
        const forgeVersions = await getSWRV(getForgeVersionsModel(minecraft), cfg)
        const found = forgeVersions.find(v => v.version === forge)
        const forgeVersionId = found?.version ?? forge
        forgeVersion = await installForge({ mcversion: minecraft, version: forgeVersionId, installer: found?.installer })
      } else {
        forgeVersion = localForge.id
        await refreshVersion(localForge.id)
      }
    }

    if (neoForged) {
      const localNeoForge = local.find(v => v.neoForged === neoForged && v.minecraft === minecraft)
      if (!localNeoForge) {
        const neoForgedVersion = await getSWRV(getNeoForgedVersionModel(minecraft), cfg)
        const found = neoForgedVersion.find(v => v === neoForged)
        const id = found ?? neoForged
        forgeVersion = await installNeoForged({ version: id, minecraft })
      } else {
        forgeVersion = localNeoForge.id
        await refreshVersion(localNeoForge.id)
      }
    }

    if (optifine) {
      let optifineVersion = optifine
      if (optifineVersion.startsWith(minecraft)) {
        optifineVersion = optifineVersion.substring(minecraft.length)
      }
      const localOptifine = local.find(v => v.minecraft === minecraft && v.optifine === optifineVersion && v.forge === (forgeVersion || ''))
      if (localOptifine) {
        await refreshVersion(localOptifine.id)
        return localOptifine.id
      }
      const { type, patch } = parseOptifineVersion(optifineVersion)
      const [ver] = await installOptifine({ type, patch, mcversion: minecraft, inheritFrom: forgeVersion })
      return ver
    } else if (forgeVersion) {
      return forgeVersion
    }

    if (fabricLoader) {
      const localFabric = local.find(v => v.fabric === fabricLoader && v.minecraft === runtime.minecraft)
      if (localFabric) {
        await refreshVersion(localFabric.id)
        return localFabric.id
      }
      return await installFabric({ loader: fabricLoader, minecraft })
    }

    if (quiltLoader) {
      const localQuilt = local.find(v => v.quilt === quiltLoader && v.minecraft === runtime.minecraft)
      if (localQuilt) {
        await refreshVersion(localQuilt.id)
        return localQuilt.id
      }
      return await installQuilt({ version: quiltLoader, minecraftVersion: minecraft })
    }

    if (labyMod) {
      const localLabyMod = local.find(v => v.labyMod === labyMod && v.minecraft === runtime.minecraft)
      if (localLabyMod) {
        await refreshVersion(localLabyMod.id)
        return localLabyMod.id
      }

      const manifest = await getSWRV(getLabyModManifestModel(), cfg)

      return await installLabyModVersion({ manifest, minecraftVersion: minecraft })
    }

    return minecraft
  }

  async function installServer(runtime: RuntimeVersions, path: string, versionId: string | undefined) {
    const { minecraft, forge, fabricLoader, quiltLoader, optifine, neoForged, labyMod } = runtime

    if (versionId) {
      await installMinecraftJar(minecraft, 'server')
    } else {
      const mcVersions = await getSWRV(getMinecraftVersionsModel(), cfg)
      const metadata = mcVersions.versions.find(v => v.id === minecraft)!
      await installMinecraft(metadata, 'server')
    }

    if (forge) {
      const forgeServer = servers.value.find(v => v.version === forge && v.minecraft === minecraft && v.type === 'forge')
      if (forgeServer) return forgeServer.id
      const forgeVersions = await getSWRV(getForgeVersionsModel(minecraft), cfg)
      const found = forgeVersions.find(v => v.version === forge)
      const forgeVersionId = found?.version ?? forge
      const id = await installForge({ mcversion: minecraft, version: forgeVersionId, installer: found?.installer, side: 'server', root: path })
      return id
    }

    if (neoForged) {
      const neoForgeServer = servers.value.find(v => v.version === neoForged && v.minecraft === minecraft && v.type === 'neoforge')
      if (neoForgeServer) return neoForgeServer.id

      return await installNeoForged({ version: neoForged, minecraft, side: 'server' })
    }

    if (fabricLoader) {
      const fabricServer = servers.value.find(v => v.version === fabricLoader && v.minecraft === minecraft && v.type === 'fabric')
      if (fabricServer) return fabricServer.id

      return await installFabric({ loader: fabricLoader, minecraft, side: 'server' })
    }

    if (quiltLoader) {
      const quiltServer = servers.value.find(v => v.version === quiltLoader && v.minecraft === minecraft && v.type === 'quilt')
      if (quiltServer) return quiltServer.id

      return await installQuilt({ version: quiltLoader, minecraftVersion: minecraft, side: 'server' })
    }

    return minecraft
  }

  return {
    install,
    installServer,
  }
}

export function useInstanceVersionInstallInstruction(path: Ref<string>, instances: Ref<Instance[]>, resolvedVersion: Ref<InstanceResolveVersion | undefined>, versions: Ref<VersionHeader[]>, servers: Ref<ServerVersionHeader[]>, javas: Ref<JavaRecord[]>) {
  const { diagnoseAssetIndex, diagnoseAssets, diagnoseJar, diagnoseLibraries, diagnoseProfile } = useService(DiagnoseServiceKey)
  const { installAssetsForVersion, installForge, installAssets, installMinecraftJar, installLibraries, installNeoForged, installDependencies, installOptifine, installByProfile } = useService(InstallServiceKey)
  const { editInstance } = useService(InstanceServiceKey)
  const { resolveLocalVersion } = useService(VersionServiceKey)
  const { installDefaultJava } = useService(JavaServiceKey)

  const { install, installServer } = useInstanceVersionInstall(versions, servers)

  let abortController = new AbortController()
  const instruction: ShallowRef<InstanceInstallInstruction | undefined> = shallowRef(undefined)
  const loading = ref(false)
  const config = inject(kSWRVConfig)

  const instanceLock: Record<string, ReadWriteLock> = {}

  async function update(version: InstanceResolveVersion | undefined) {
    if (!version) return
    abortController.abort()
    abortController = new AbortController()
    abortController.signal.addEventListener('abort', () => {
      loading.value = false
    })
    try {
      loading.value = true
      const lock = getInstanceLock(path.value)
      console.time('[getInstallInstruction]')
      await lock.write(async () => {
        try {
          const _path = version.instance
          const _selectedVersion = version.version
          const runtiems = { ...version.requirements }
          const resolved = 'id' in version ? { ...version } : undefined
          if (_path !== path.value) {
            return
          }
          const result = await getInstallInstruction(_path, runtiems, _selectedVersion, resolved, javas.value, abortController.signal)
          if (_path !== path.value) {
            return
          }
          instruction.value = result
        } catch (e) {
          if (e === kAbort) {
            return
          }
          throw e
        }
      })
    } finally {
      console.timeEnd('[getInstallInstruction]')
      loading.value = false
    }
  }

  function getInstanceLock(path: string) {
    const lock = instanceLock[path]
    if (lock) {
      return lock
    }
    const newLock = new ReadWriteLock()
    instanceLock[path] = newLock
    return newLock
  }

  function getJavaInstall(javas: JavaRecord[], resolved: ResolvedVersion, instance: string) {
    const inst = instances.value.find(i => i.path === instance)
    if (inst?.java) {
      return undefined
    }
    const validJava = javas.find(v => v.majorVersion === resolved.javaVersion.majorVersion && v.valid)
    return validJava ? undefined : resolved.javaVersion
  }

  async function getInstallInstruction(instance: string, runtime: RuntimeVersions, version: string, resolved: ResolvedVersion | undefined, javas: JavaRecord[], abortSignal?: AbortSignal): Promise<InstanceInstallInstruction> {
    const result: InstanceInstallInstruction = {
      instance,
      runtime: { ...runtime },
      version,
    }
    if (!resolved) {
      return result
    }

    result.resolvedVersion = resolved.id

    result.java = getJavaInstall(javas, resolved, instance)

    const profileIssue = await diagnoseProfile(resolved.id, 'client', path.value)
    if (abortSignal?.aborted) { throw kAbort }

    if (profileIssue) {
      result.profile = markRaw(profileIssue)
      return result
    }

    const jarIssue = await diagnoseJar(resolved, 'client')
    if (abortSignal?.aborted) { throw kAbort }
    if (jarIssue) {
      result.jar = markRaw(jarIssue)
    }

    const librariesIssue = await diagnoseLibraries(resolved)
    if (abortSignal?.aborted) { throw kAbort }
    if (librariesIssue.length > 0) {
      const optifinesIssues = [] as LibraryIssue[]
      const forgeIssues = [] as LibraryIssue[]
      const commonIssues = [] as LibraryIssue[]
      for (const i of librariesIssue) {
        if (i.library.groupId === 'optifine') {
          optifinesIssues.push(i)
        } else if (i.library.groupId === 'net.minecraftforge' && i.library.artifactId === 'forge' && (i.library.classifier === 'client' || !i.library.classifier)) {
          forgeIssues.push(i)
        } else {
          commonIssues.push(i)
        }
      }
      if (commonIssues.length > 0) {
        result.libriares = commonIssues
      }
      if (optifinesIssues.length > 0) {
        const { type, patch } = parseOptifineVersion(runtime.optifine!)
        result.optifine = {
          minecraft: resolved.minecraftVersion,
          type,
          patch,
        }
      }
      if (forgeIssues.length > 0) {
        result.forge = {
          minecraft: resolved.minecraftVersion,
          version: runtime.forge!,
        }
      }
    }

    const assetIndexIssue = await diagnoseAssetIndex(resolved)
    if (abortSignal?.aborted) { throw kAbort }

    if (assetIndexIssue) {
      result.assetIndex = assetIndexIssue
    } else {
      const assetsIssue = await diagnoseAssets(resolved)
      if (abortSignal?.aborted) { throw kAbort }
      if (assetsIssue.length > 0) {
        result.assets = assetsIssue
      }
    }

    return markRaw(result)
  }

  async function handleInstallInstruction(instruction: InstanceInstallInstruction) {
    const commit = (version: string) => {
      // due to the async, we need to check if the instance is still proper to edit
      const old = instruction.runtime
      const inst = instances.value.find(i => i.path === instruction.instance)
      const cur = inst?.runtime
      const valid = old.minecraft === cur?.minecraft &&
        old.forge === cur?.forge &&
        old.fabricLoader === cur?.fabricLoader &&
        old.optifine === cur?.optifine &&
        old.neoForged === cur?.neoForged &&
        old.labyMod === cur?.labyMod &&
        old.quiltLoader === cur?.quiltLoader
      if (!valid) return
      if (instruction.version !== inst?.version) return

      return editInstance({
        instancePath: instruction.instance,
        version,
      })
    }
    if (!instruction.resolvedVersion) {
      const version = await install(instruction.runtime)
      if (version) {
        await installDependencies(version, 'client')
        const resolved = await resolveLocalVersion(version)
        const java = getJavaInstall(javas.value, resolved, instruction.instance)
        if (java) {
          await installDefaultJava(java)
        }
      }

      await commit(version)
      return
    }
    if (instruction.profile) {
      await installByProfile(instruction.profile.installProfile)
      if (instruction.version) {
        await installDependencies(instruction.version, 'client')
        const resolved = await resolveLocalVersion(instruction.version)
        const java = getJavaInstall(javas.value, resolved, instruction.instance)
        if (java) {
          await installDefaultJava(java)
        }
      }
      return
    }
    if (instruction.optifine) {
      const [version] = await installOptifine({
        mcversion: instruction.optifine.minecraft,
        type: instruction.optifine.type,
        patch: instruction.optifine.patch,
      })
      if (version) {
        await installDependencies(version, 'client')
        const resolved = await resolveLocalVersion(version)
        const java = getJavaInstall(javas.value, resolved, instruction.instance)
        if (java) {
          await installDefaultJava(java)
        }
      }
      await commit(version)
      return
    }
    if (instruction.forge) {
      const version = await installForge({
        mcversion: instruction.forge.minecraft,
        version: instruction.forge.version,
      })
      if (version) {
        await installDependencies(version, 'client')
        const resolved = await resolveLocalVersion(version)
        const java = getJavaInstall(javas.value, resolved, instruction.instance)
        if (java) {
          await installDefaultJava(java)
        }
      }
      await commit(version)
      return
    }

    const resolved = await resolveLocalVersion(instruction.resolvedVersion)
    const java = getJavaInstall(javas.value, resolved, instruction.instance)
    if (java) {
      await installDefaultJava(java)
    }
    if (instruction.jar) {
      await installMinecraftJar(instruction.runtime.minecraft, 'client')
    }
    if (instruction.libriares) {
      await installLibraries(instruction.libriares.map(v => v.library), instruction.runtime.minecraft, instruction.libriares.length > 15)
    }
    if (instruction.assetIndex) {
      const list = await getSWRV(getMinecraftVersionsModel(), config)
      await installAssetsForVersion(instruction.assetIndex.version, list.versions.filter(v => v.id === instruction.runtime.minecraft || v.id === instruction.runtime.assets))
    } else if (instruction.assets) {
      await installAssets(instruction.assets.map(v => v.asset), instruction.runtime.minecraft, instruction.assets.length > 15)
    }
  }

  async function fix() {
    const inst = instruction.value
    if (!inst) {
      return
    }
    const last = resolvedVersion.value
    const lock = getInstanceLock(path.value)
    await lock.write(() => handleInstallInstruction(inst))
    if (last === resolvedVersion.value) {
      await update(last)
    }
  }

  watch(resolvedVersion, (v) => {
    instruction.value = undefined
    update(v)
  }, { immediate: true })

  return {
    instruction,
    fix,
    loading,
    getInstanceLock,

    getInstallInstruction,
    handleInstallInstruction,

    install,
    installServer,
  }
}
