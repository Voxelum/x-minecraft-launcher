import { appInsights } from '@/telemetry'
import { AnyError } from '@/util/error'
import { getSWRV } from '@/util/swrvGet'
import type { JavaVersion, ResolvedVersion } from '@xmcl/core'
import type { InstallIssue } from '@xmcl/installer'
import {
  InstallServiceKey,
  InstanceServiceKey,
  JavaRecord,
  JavaServiceKey,
  ServerVersionHeader,
  VersionHeader,
  VersionServiceKey,
  findMatchedVersion,
  parseOptifineVersion,
} from '@xmcl/runtime-api'
import { Mutex } from 'async-mutex'
import { InjectionKey, Ref, ShallowRef } from 'vue'
import { InstanceResolveVersion } from './instanceVersion'
import { useNotifier } from './notifier'
import { useService } from './service'
import { kSWRVConfig } from './swrvConfig'
import {
  getForgeVersionsModel,
  getLabyModManifestModel,
  getMinecraftVersionsModel,
  getNeoForgedVersionModel,
} from './version'
import { Instance, PartialRuntimeVersions, RuntimeVersions } from '@xmcl/instance'

export interface InstanceInstallInstruction extends InstallIssue {
  instance: string
  runtime: PartialRuntimeVersions
  java?: JavaVersion
  version: string
  resolvedVersion?: string
}

export const kInstanceVersionInstall = Symbol('InstanceVersionInstall') as InjectionKey<
  ReturnType<typeof useInstanceVersionInstallInstruction>
>
const kAbort = Symbol('Aborted')

function getJavaPathOrInstall(
  instances: Instance[],
  javas: JavaRecord[],
  resolved: ResolvedVersion,
  instance: string,
) {
  const inst = instances.find((i) => i.path === instance)
  if (inst?.java) {
    return inst.java
  }
  const validJava = javas.find(
    (v) => v.majorVersion === resolved.javaVersion.majorVersion && v.valid,
  )
  return validJava ? validJava.path : resolved.javaVersion
}

function useInstanceVersionInstall(
  versions: Ref<VersionHeader[]>,
  servers: Ref<ServerVersionHeader[]>,
  instances: Ref<Instance[]>,
  javas: Ref<JavaRecord[]>,
  refreshJava: () => Promise<void>,
) {
  const {
    installForge,
    installNeoForged,
    installMinecraft,
    installOptifine,
    installFabric,
    installQuilt,
    installLabyModVersion,
  } = useService(InstallServiceKey)
  const { refreshVersion, refreshServerVersion, resolveLocalVersion } =
    useService(VersionServiceKey)
  const { installJava } = useService(JavaServiceKey)

  const cfg = inject(kSWRVConfig)

  function onInstallForgeError(e: any): never {
    if (e.code === 'ENOENT') {
      refreshJava()
    }
    throw e
  }

  async function install(runtime: PartialRuntimeVersions) {
    const { minecraft, forge, fabricLoader, quiltLoader, optifine, neoForged, labyMod } = runtime
    const mcVersions = await getSWRV(getMinecraftVersionsModel(), cfg)
    const local = versions.value
    const metadata = mcVersions.versions.find((v) => v.id === minecraft)
    if (metadata) {
      await installMinecraft({ meta: metadata, side: 'client' })
    } else {
      const exception = new AnyError(
        'InstallMinecraftClientError',
        `Cannot find the minecraft version ${minecraft}`,
        {},
        {
          minecraft,
        },
      )
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
    const javaPath =
      typeof javaOrInstall === 'string'
        ? javaOrInstall
        : await installJava(javaOrInstall).then((r) => r.path)

    let labyModBase = ''
    if (labyMod) {
      const localLabyMod = findMatchedVersion(local, '', {
        minecraft,
        labyMod,
      })
      if (localLabyMod) {
        await refreshVersion(localLabyMod.id)
        labyModBase = localLabyMod.id
      } else {
        const manifest = await getSWRV(getLabyModManifestModel(), cfg)

        labyModBase = await installLabyModVersion({ manifest, minecraftVersion: minecraft })
      }
    }

    let forgeVersion = undefined as undefined | string
    if (forge) {
      const localForge = findMatchedVersion(local, '', {
        minecraft,
        forge,
        labyMod,
      })
      if (!localForge) {
        const forgeVersions = await getSWRV(getForgeVersionsModel(minecraft), cfg)
        const found = forgeVersions.find((v) => v.version === forge)
        const forgeVersionId = found?.version ?? forge

        forgeVersion = await installForge({
          mcversion: minecraft,
          version: forgeVersionId,
          installer: found?.installer,
          java: javaPath,
          base: labyModBase,
        }).catch(onInstallForgeError)
      } else {
        forgeVersion = localForge.id
        await refreshVersion(localForge.id)
      }
    }

    if (neoForged) {
      const localNeoForge = findMatchedVersion(local, '', {
        minecraft,
        neoForged,
        labyMod,
      })
      if (!localNeoForge) {
        const neoForgedVersion = await getSWRV(getNeoForgedVersionModel(minecraft), cfg)
        const found = neoForgedVersion.find((v) => v === neoForged)
        const id = found ?? neoForged

        forgeVersion = await installNeoForged({
          version: id,
          minecraft,
          java: javaPath,
          base: labyModBase,
        }).catch(onInstallForgeError)
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
      const localOptifine = findMatchedVersion(local, '', {
        minecraft,
        optifine: optifineVersion,
        forge: forgeVersion || '',
      })
      if (localOptifine) {
        await refreshVersion(localOptifine.id)
        return localOptifine.id
      }
      const { type, patch } = parseOptifineVersion(optifineVersion)

      const ver = await installOptifine({
        type,
        patch,
        mcversion: minecraft,
        inheritFrom: forgeVersion,
        java: javaPath,
      })
      return ver
    } else if (forgeVersion) {
      return forgeVersion
    }

    if (fabricLoader) {
      const localFabric = findMatchedVersion(local, '', {
        fabricLoader,
        minecraft,
        labyMod,
      })
      if (localFabric) {
        await refreshVersion(localFabric.id)
        return localFabric.id
      }
      return await installFabric({ loader: fabricLoader, minecraft, base: labyModBase })
    }

    if (quiltLoader) {
      const localQuilt = findMatchedVersion(local, '', {
        quiltLoader,
        minecraft,
        labyMod,
      })
      if (localQuilt) {
        await refreshVersion(localQuilt.id)
        return localQuilt.id
      }
      return await installQuilt({
        version: quiltLoader,
        minecraftVersion: minecraft,
        base: labyModBase,
      })
    }

    return minecraft
  }

  async function installServer(runtime: RuntimeVersions, path: string) {
    const { minecraft, forge, fabricLoader, quiltLoader, optifine, neoForged, labyMod } = runtime

    const mcVersions = await getSWRV(getMinecraftVersionsModel(), cfg)
    const metadata = mcVersions.versions.find((v) => v.id === minecraft)
    if (metadata) {
      await installMinecraft({ meta: metadata, side: 'server' })
    } else {
      const exception = new AnyError(
        'InstallServerError',
        `Cannot find the minecraft version ${minecraft}`,
        {},
        {
          minecraft,
        },
      )
      appInsights.trackException({ exception })
      throw exception
    }

    if (forge) {
      const forgeServer = servers.value.find(
        (v) => v.version === forge && v.minecraft === minecraft && v.type === 'forge',
      )
      if (forgeServer) return forgeServer.id
      const forgeVersions = await getSWRV(getForgeVersionsModel(minecraft), cfg)
      const found = forgeVersions.find((v) => v.version === forge)
      const forgeVersionId = found?.version ?? forge

      if (javas.value.length === 0 || javas.value.every((java) => !java.valid)) {
        // no valid java
        const mcVersionResolved = await resolveLocalVersion(minecraft)
        await installJava(mcVersionResolved.javaVersion)
      }

      const id = await installForge({
        mcversion: minecraft,
        version: forgeVersionId,
        installer: found?.installer,
        side: 'server',
        root: path,
      })

      refreshServerVersion(id)

      return id
    }

    if (neoForged) {
      const neoForgeServer = servers.value.find(
        (v) => v.version === neoForged && v.minecraft === minecraft && v.type === 'neoforge',
      )
      if (neoForgeServer) return neoForgeServer.id

      const id = await installNeoForged({ version: neoForged, minecraft, side: 'server' })

      refreshServerVersion(id)

      return id
    }

    if (fabricLoader) {
      const fabricServer = servers.value.find(
        (v) => v.version === fabricLoader && v.minecraft === minecraft && v.type === 'fabric',
      )
      if (fabricServer) return fabricServer.id

      const id = await installFabric({ loader: fabricLoader, minecraft, side: 'server' })

      refreshServerVersion(id)

      return id
    }

    if (quiltLoader) {
      const quiltServer = servers.value.find(
        (v) => v.version === quiltLoader && v.minecraft === minecraft && v.type === 'quilt',
      )
      if (quiltServer) return quiltServer.id

      const id = await installQuilt({
        version: quiltLoader,
        minecraftVersion: minecraft,
        side: 'server',
      })

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

export function useInstanceVersionInstallInstruction(
  path: Ref<string>,
  instances: Ref<Instance[]>,
  resolvedVersion: Ref<InstanceResolveVersion | undefined>,
  refreshResolvedVersion: () => void,
  versions: Ref<VersionHeader[]>,
  servers: Ref<ServerVersionHeader[]>,
  javas: Ref<JavaRecord[]>,
  refreshJava: () => Promise<void>,
) {
  const {
    diagnose,
    installAssetsForVersion,
    installForge,
    installAssets,
    installMinecraftJar,
    installLibraries,
    installDependencies,
    installOptifine,
    installByProfile,
  } = useService(InstallServiceKey)
  const { editInstance } = useService(InstanceServiceKey)
  const { resolveLocalVersion } = useService(VersionServiceKey)
  const { installJava } = useService(JavaServiceKey)
  const { notify } = useNotifier()

  const { install, installServer } = useInstanceVersionInstall(
    versions,
    servers,
    instances,
    javas,
    refreshJava,
  )

  let abortController = new AbortController()
  const instruction: ShallowRef<InstanceInstallInstruction | undefined> = shallowRef(undefined)
  const loading = ref(0)
  const config = inject(kSWRVConfig)

  const instanceLock: Record<string, Mutex> = {}

  async function update(
    version: InstanceResolveVersion | undefined,
    jres: JavaRecord[] = javas.value,
  ) {
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
          console.log(
            '[installProfile]',
            'start to get install profile',
            'resolved:',
            resolved ? resolved.id : 'unresolved',
          )
          const result = await getInstallInstruction(
            _path,
            runtiems,
            _selectedVersion,
            resolved,
            jres,
            abortController.signal,
          )
          console.log(
            '[installProfile]',
            'got install profile',
            'resolved:',
            result.resolvedVersion ? result.resolvedVersion : 'unresolved',
          )
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
      console.log('[installProfile]', 'Full install profile update', timeEnd - timeStart, 'ms')
    } catch (e) {
      if (e === kAbort) {
        const timeEnd = performance.now()
        console.log(
          '[installProfile]',
          'Aborted install profile update',
          timeEnd - timeStart,
          'ms',
        )
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
  async function getInstallInstruction(
    instance: string,
    runtime: PartialRuntimeVersions,
    version: string,
    resolved: ResolvedVersion | undefined,
    javas: JavaRecord[],
    abortSignal?: AbortSignal,
  ): Promise<InstanceInstallInstruction> {
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

    const issue = await diagnose({ currentVersion: resolved, side: 'client' })
    if (abortSignal?.aborted) {
      throw kAbort
    }
    Object.assign(result, issue)
    // {
    //   minecraft: runtime.minecraft,
    //   ...parseOptifineVersion(runtime.optifine || issue.optifine),
    // }

    return markRaw(result)
  }

  async function handleInstallInstruction(instruction: InstanceInstallInstruction) {
    const commit = (version: string) => {
      // due to the async, we need to check if the instance is still proper to edit
      const old = instruction.runtime
      const inst = instances.value.find((i) => i.path === instruction.instance)
      const cur = inst?.runtime
      const valid =
        old.minecraft === cur?.minecraft &&
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
        // install fresh version
        const version = await install(instruction.runtime)
        if (version) {
          await installDependencies({ version, side: 'client' })
        }

        await commit(version)
        return
      }
      const version = instruction.resolvedVersion
      if (instruction.jar) {
        await installMinecraftJar({
          version,
          side: 'client',
        })
      }
      if (instruction.profile) {
        const resolved = await resolveLocalVersion(version)
        const java = getJavaPathOrInstall(
          instances.value,
          javas.value,
          resolved,
          instruction.instance,
        )
        const javaPath =
          typeof java === 'string' ? java : await installJava(java).then((r) => r.path)

        await installByProfile({
          profile: instruction.profile,
          side: 'client',
          java: javaPath,
        })

        await installDependencies({ version: version, side: 'client' })
        return
      }
      if (instruction.optifine) {
        const version = await installOptifine({
          mcversion: instruction.runtime.minecraft,
          ...parseOptifineVersion(instruction.optifine),
        })
        await installDependencies({ version, side: 'client' })
        const resolved = await resolveLocalVersion(version)
        const java = getJavaPathOrInstall(
          instances.value,
          javas.value,
          resolved,
          instruction.instance,
        )
        if (typeof java === 'object') {
          await installJava(java)
        }
        await commit(version)
        return
      }
      if (instruction.forge) {
        const resolved = await resolveLocalVersion(instruction.forge.minecraft)
        const java = getJavaPathOrInstall(
          instances.value,
          javas.value,
          resolved,
          instruction.instance,
        )
        const javaPath =
          typeof java === 'string' ? java : await installJava(java).then((r) => r.path)

        const version = await installForge({
          mcversion: instruction.forge.minecraft,
          version: instruction.forge.version,
          java: javaPath,
          side: 'client',
        })
        await installDependencies({ version, side: 'client' })
        await commit(version)
        return
      }

      const resolved = await resolveLocalVersion(version)
      const java = getJavaPathOrInstall(
        instances.value,
        javas.value,
        resolved,
        instruction.instance,
      )
      if (typeof java === 'object') {
        await installJava(java)
      }
      if (instruction.libraries) {
        console.log('Installing libraries', version)
        await installLibraries({
          libraries: instruction.libraries,
          version: instruction.runtime.minecraft,
          force: instruction.libraries.length > 15,
        })
      }
      if (instruction.assetsIndex) {
        const list = await getSWRV(getMinecraftVersionsModel(), config)
        await installAssetsForVersion({
          version,
          fallbackVersionMetadata: list.versions.filter(
            (v) => v.id === version || v.id === instruction.assetsIndex?.id,
          ),
        })
        refreshResolvedVersion()
      } else if (instruction.assets) {
        await installAssets({
          assets: instruction.assets,
          key: instruction.runtime.minecraft,
          force: instruction.assets.length > 15,
        })
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

  const fixingInstance = shallowRef<Record<string, boolean>>({})
  function isInstanceFixing(path: string) {
    return fixingInstance.value[path] === true
  }

  async function fix() {
    const inst = instruction.value
    if (!inst) {
      return
    }
    // await refreshResolvedVersion()
    const last = resolvedVersion.value
    const lock = getInstanceLock(inst.instance)
    fixingInstance.value = {
      ...fixingInstance.value,
      [inst.instance]: true,
    }
    try {
      await lock.runExclusive(() => handleInstallInstruction(inst))
      if (last === resolvedVersion.value) {
        await update(last)
      }
    } finally {
      fixingInstance.value = {
        ...fixingInstance.value,
        [inst.instance]: false,
      }
    }
  }

  watch(
    [resolvedVersion, javas],
    ([v]) => {
      instruction.value = undefined
      update(v, javas.value)
    },
    { immediate: true },
  )

  return {
    instruction,
    fix,
    loading: computed(() => loading.value > 0),
    getInstanceLock,
    isInstanceFixing,

    getInstallInstruction,
    handleInstallInstruction,

    install,
    installServer,
  }
}
