import { appInsights } from '@/telemetry'
import { AnyError } from '@/util/error'
import { getSWRV } from '@/util/swrvGet'
import type { AssetIndexIssue, AssetIssue, JavaVersion, LibraryIssue, MinecraftJarIssue, ResolvedVersion } from '@xmcl/core'
import type { InstallProfileIssueReport } from '@xmcl/installer'
import { DiagnoseServiceKey, InstallServiceKey, Instance, InstanceServiceKey, JavaRecord, JavaServiceKey, RuntimeVersions, ServerVersionHeader, VersionHeader, VersionServiceKey, parseOptifineVersion } from '@xmcl/runtime-api'
import { Mutex } from 'async-mutex'
import { InjectionKey, Ref, ShallowRef } from 'vue'
import { InstanceResolveVersion } from './instanceVersion'
import { useNotifier } from './notifier'
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

function getJavaPathOrInstall(instances: Instance[], javas: JavaRecord[], resolved: ResolvedVersion, instance: string) {
  const inst = instances.find(i => i.path === instance)
  if (inst?.java) {
    return inst.java
  }
  const validJava = javas.find(v => v.majorVersion === resolved.javaVersion.majorVersion && v.valid)
  return validJava ? validJava.path : resolved.javaVersion
}


function useInstanceVersionInstall(versions: Ref<VersionHeader[]>, servers: Ref<ServerVersionHeader[]>, instances: Ref<Instance[]>, javas: Ref<JavaRecord[]>, refreshJava: () => Promise<void>) {
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
  const { refreshVersion, refreshServerVersion, resolveLocalVersion } = useService(VersionServiceKey)
  const { installJava } = useService(JavaServiceKey)

  const cfg = inject(kSWRVConfig)

  function onInstallForgeError(e: any): never {
    if (e.code === 'ENOENT') {
      refreshJava()
    }
    throw e
  }

  async function install(runtime: RuntimeVersions) {
    const { minecraft, forge, fabricLoader, quiltLoader, optifine, neoForged, labyMod } = runtime
    const mcVersions = await getSWRV(getMinecraftVersionsModel(), cfg)
    const local = versions.value
    const metadata = mcVersions.versions.find(v => v.id === minecraft)
    if (metadata) {
      await installMinecraft(metadata, 'client')
    } else {
      const exception = new AnyError('InstallMinecraftClientError', `Cannot find the minecraft version ${minecraft}`, {}, {
        minecraft,
      })
      appInsights.trackException({ exception })
      throw exception
    }

    const resolvedMcVersion = await resolveLocalVersion(minecraft).catch((e) => {
      if (e.name === 'Error') {
        e.name = 'InstallMinecraftClientError'
      }
      appInsights.trackException({ exception: e })
      throw e
    })

    const javaOrInstall = getJavaPathOrInstall(instances.value, javas.value, resolvedMcVersion, '')
    const javaPath = typeof javaOrInstall === 'string' ? javaOrInstall : await installJava(javaOrInstall).then((r) => r.path)

    let forgeVersion = undefined as undefined | string
    if (forge) {
      const localForge = local.find(v => v.forge === forge && v.minecraft === minecraft)
      if (!localForge) {
        const forgeVersions = await getSWRV(getForgeVersionsModel(minecraft), cfg)
        const found = forgeVersions.find(v => v.version === forge)
        const forgeVersionId = found?.version ?? forge

        forgeVersion = await installForge({ mcversion: minecraft, version: forgeVersionId, installer: found?.installer, java: javaPath }).catch(onInstallForgeError)
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

        forgeVersion = await installNeoForged({ version: id, minecraft, java: javaPath }).catch(onInstallForgeError)
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

      const ver = await installOptifine({ type, patch, mcversion: minecraft, inheritFrom: forgeVersion, java: javaPath })
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

  async function installServer(runtime: RuntimeVersions, path: string) {
    const { minecraft, forge, fabricLoader, quiltLoader, optifine, neoForged, labyMod } = runtime

    const mcVersions = await getSWRV(getMinecraftVersionsModel(), cfg)
    const metadata = mcVersions.versions.find(v => v.id === minecraft)
    if (metadata) {
      await installMinecraft(metadata, 'server')
    } else {
      const exception = new AnyError('InstallServerError', `Cannot find the minecraft version ${minecraft}`, {}, {
        minecraft,
      })
      appInsights.trackException({ exception })
      throw exception
    }

    if (forge) {
      const forgeServer = servers.value.find(v => v.version === forge && v.minecraft === minecraft && v.type === 'forge')
      if (forgeServer) return forgeServer.id
      const forgeVersions = await getSWRV(getForgeVersionsModel(minecraft), cfg)
      const found = forgeVersions.find(v => v.version === forge)
      const forgeVersionId = found?.version ?? forge

      if (javas.value.length === 0 || javas.value.every(java => !java.valid)) {
        // no valid java
        const mcVersionResolved = await resolveLocalVersion(minecraft)
        await installJava(mcVersionResolved.javaVersion)
      }

      const id = await installForge({ mcversion: minecraft, version: forgeVersionId, installer: found?.installer, side: 'server', root: path })

      refreshServerVersion(id)

      return id
    }

    if (neoForged) {
      const neoForgeServer = servers.value.find(v => v.version === neoForged && v.minecraft === minecraft && v.type === 'neoforge')
      if (neoForgeServer) return neoForgeServer.id

      const id = await installNeoForged({ version: neoForged, minecraft, side: 'server' })

      refreshServerVersion(id)

      return id
    }

    if (fabricLoader) {
      const fabricServer = servers.value.find(v => v.version === fabricLoader && v.minecraft === minecraft && v.type === 'fabric')
      if (fabricServer) return fabricServer.id

      const id = await installFabric({ loader: fabricLoader, minecraft, side: 'server' })

      refreshServerVersion(id)

      return id
    }

    if (quiltLoader) {
      const quiltServer = servers.value.find(v => v.version === quiltLoader && v.minecraft === minecraft && v.type === 'quilt')
      if (quiltServer) return quiltServer.id

      const id = await installQuilt({ version: quiltLoader, minecraftVersion: minecraft, side: 'server' })

      refreshServerVersion(id)

      return id
    }

    return minecraft
  }

  return {
    install,
    installServer,
  }
}

export function useInstanceVersionInstallInstruction(path: Ref<string>, instances: Ref<Instance[]>, resolvedVersion: Ref<InstanceResolveVersion | undefined>, refreshResolvedVersion: () => void, versions: Ref<VersionHeader[]>, servers: Ref<ServerVersionHeader[]>, javas: Ref<JavaRecord[]>, refreshJava: () => Promise<void>) {
  const { diagnoseAssets, diagnoseJar, diagnoseLibraries, diagnoseProfile } = useService(DiagnoseServiceKey)
  const { installAssetsForVersion, installForge, installAssets, installMinecraftJar, installLibraries, installNeoForged, installDependencies, installOptifine, installByProfile } = useService(InstallServiceKey)
  const { editInstance } = useService(InstanceServiceKey)
  const { resolveLocalVersion } = useService(VersionServiceKey)
  const { installJava } = useService(JavaServiceKey)
  const { notify } = useNotifier()

  const { install, installServer } = useInstanceVersionInstall(versions, servers, instances, javas, refreshJava)

  let abortController = new AbortController()
  const instruction: ShallowRef<InstanceInstallInstruction | undefined> = shallowRef(undefined)
  const loading = ref(0)
  const config = inject(kSWRVConfig)

  const instanceLock: Record<string, Mutex> = {}

  async function update(version: InstanceResolveVersion | undefined, jres: JavaRecord[] = javas.value) {
    if (!version) return
    abortController.abort()
    abortController = new AbortController()
    const timeStart = performance.now()
    try {
      loading.value += 1
      const lock = getInstanceLock(path.value)
      await lock.runExclusive(async () => {
        try {
          const _path = version.instance
          const _selectedVersion = version.version
          const runtiems = { ...version.requirements }
          const resolved = 'id' in version ? { ...version } : undefined
          if (_path !== path.value) {
            return
          }
          const result = await getInstallInstruction(_path, runtiems, _selectedVersion, resolved, jres, abortController.signal)
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
      const timeEnd = performance.now()
      console.log('Full install profile update', timeEnd - timeStart, 'ms')
    } catch (e) {
      if (e === kAbort) {
        const timeEnd = performance.now()
        console.log('Aborted install profile update', timeEnd - timeStart, 'ms')
        return
      }
      throw e
    } finally {
      loading.value -= 1
    }
  }

  function getInstanceLock(path: string) {
    const lock = instanceLock[path]
    if (lock) {
      return lock
    }
    const newLock = new Mutex()
    instanceLock[path] = newLock
    return newLock
  }

  /**
   * @param instance The instance path
   * @param runtime The runtime version
   * @param version The version id selected in instance json
   * @param resolved The resolved version
   * @param javas The java versions
   */
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

    const javaInstallOrPath = getJavaPathOrInstall(instances.value, javas, resolved, instance)
    if (typeof javaInstallOrPath === 'object') {
      result.java = javaInstallOrPath
    }

    const jarIssue = await diagnoseJar(resolved, 'client')
    if (abortSignal?.aborted) { throw kAbort }
    if (jarIssue) {
      result.jar = markRaw(jarIssue)
    }

    const profileIssue = await diagnoseProfile(resolved.id, 'client', path.value)
    if (abortSignal?.aborted) { throw kAbort }

    if (profileIssue) {
      result.profile = markRaw(profileIssue)
      return result
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

    const { index: assetIndexIssue, assets: assetsIssue } = await diagnoseAssets(resolved)
    if (abortSignal?.aborted) { throw kAbort }

    if (assetIndexIssue) {
      result.assetIndex = assetIndexIssue
    } else {
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

    try {
      if (!instruction.resolvedVersion) {
        const version = await install(instruction.runtime)
        if (version) {
          await installDependencies(version, 'client')
        }

        await commit(version)
        return
      }
      if (instruction.jar) {
        await installMinecraftJar(instruction.version || instruction.runtime.minecraft, 'client')
      }
      if (instruction.profile) {
        const resolved = await resolveLocalVersion(instruction.resolvedVersion)
        const java = getJavaPathOrInstall(instances.value, javas.value, resolved, instruction.instance)
        const javaPath = typeof java === 'string' ? java : await installJava(java).then((r) => r.path)

        await installByProfile({ profile: instruction.profile.installProfile, side: 'client', java: javaPath })

        if (instruction.version) {
          await installDependencies(instruction.version, 'client')
        }
        return
      }
      if (instruction.optifine) {
        const version = await installOptifine({
          mcversion: instruction.optifine.minecraft,
          type: instruction.optifine.type,
          patch: instruction.optifine.patch,
        })
        await installDependencies(version, 'client')
        const resolved = await resolveLocalVersion(version)
        const java = getJavaPathOrInstall(instances.value, javas.value, resolved, instruction.instance)
        if (typeof java === 'object') {
          await installJava(java)
        }
        await commit(version)
        return
      }
      if (instruction.forge) {
        const resolved = await resolveLocalVersion(instruction.forge.minecraft)
        const java = getJavaPathOrInstall(instances.value, javas.value, resolved, instruction.instance)
        const javaPath = typeof java === 'string' ? java : await installJava(java).then((r) => r.path)

        const version = await installForge({
          mcversion: instruction.forge.minecraft,
          version: instruction.forge.version,
          java: javaPath,
          side: 'client',
        })
        await installDependencies(version, 'client')
        await commit(version)
        return
      }

      const resolved = await resolveLocalVersion(instruction.resolvedVersion)
      const java = getJavaPathOrInstall(instances.value, javas.value, resolved, instruction.instance)
      if (typeof java === 'object') {
        await installJava(java)
      }
      if (instruction.libriares) {
        await installLibraries(instruction.libriares.map(v => v.library), instruction.runtime.minecraft, instruction.libriares.length > 15)
      }
      if (instruction.assetIndex) {
        const list = await getSWRV(getMinecraftVersionsModel(), config)
        await installAssetsForVersion(instruction.assetIndex.version, list.versions.filter(v => v.id === instruction.runtime.minecraft || v.id === instruction.assetIndex?.version))
        refreshResolvedVersion()
      } else if (instruction.assets) {
        await installAssets(instruction.assets.map(v => v.asset), instruction.runtime.minecraft, instruction.assets.length > 15)
      }
    } catch (e) {
      const err = e as Error
      if (err.name) {
        if (err.name === 'Error') {
          err.name = 'InstallInstallInstructionError'
        }
        appInsights.trackException({ exception: err })
      }

      if (typeof e === 'object' && e && 'code' in e && typeof e.code === 'string') {
        if (e.code === 'EPERM') {
          notify({
            title: 'Permission Denied',
            body: 'You do not have permission to download. Please ensure there is no anti-virus software blocking the launcher.',
            level: 'error',
          })
        }
      }
    }
  }

  async function fix() {
    const inst = instruction.value
    if (!inst) {
      return
    }
    const last = resolvedVersion.value
    const lock = getInstanceLock(path.value)
    await lock.runExclusive(() => handleInstallInstruction(inst))
    if (last === resolvedVersion.value) {
      await update(last)
    }
  }

  watch([resolvedVersion, javas], ([v]) => {
    instruction.value = undefined
    update(v, javas.value)
  }, { immediate: true })

  return {
    instruction,
    fix,
    loading: computed(() => loading.value > 0),
    getInstanceLock,

    getInstallInstruction,
    handleInstallInstruction,

    install,
    installServer,
  }
}
