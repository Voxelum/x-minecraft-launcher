import { appInsights } from '@/telemetry'
import { AnyError, getErrorMessage, isDownloadError } from '@/util/error'
import type { JavaVersion, ResolvedVersion } from '@xmcl/core'
import type { InstallIssue } from '@xmcl/installer'
import {
  InstanceServiceKey,
  JavaRecord,
  VersionInstallServiceKey,
} from '@xmcl/runtime-api'
import { Mutex } from 'async-mutex'
import { InjectionKey, Ref, ShallowRef } from 'vue'
import { InstanceResolveVersion } from './instanceVersion'
import { useNotifier } from './notifier'
import { useService } from './service'
import { Instance, PartialRuntimeVersions, RuntimeVersions } from '@xmcl/instance'
import { useInstanceLoading } from './instanceLoading'

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

function useInstanceVersionInstall() {
  const { install: installVersion } = useService(VersionInstallServiceKey)

  async function install(runtime: PartialRuntimeVersions, instancePath = '', selectedVersion = '') {
    try {
      const result = await installVersion({
        type: 'instance',
        instancePath,
        runtime,
        selectedVersion,
      })
      console.log('[install-plan]', result)
      return result.version
    } catch (e) {
      const exception = e instanceof Error
        ? e
        : new AnyError(
            'InstallMinecraftClientError',
            getErrorMessage(e),
            undefined,
            e && typeof e === 'object' && !Array.isArray(e) ? e : undefined,
          )
      if (exception.name === 'Error') {
        exception.name = 'InstallMinecraftClientError'
      }
      appInsights.trackException({ exception })
      throw exception
    }
  }

  async function installServer(runtime: RuntimeVersions, path: string) {
    return installVersion({ type: 'server', runtime, path })
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
  javas: Ref<JavaRecord[]>,
) {
  const { diagnose } = useService(VersionInstallServiceKey)
  const { editInstance } = useService(InstanceServiceKey)
  const { notify } = useNotifier()
  const { t } = useI18n()

  const { install, installServer } = useInstanceVersionInstall()

  let abortController = new AbortController()
  const instruction: ShallowRef<InstanceInstallInstruction | undefined> = shallowRef(undefined)
  const { begin: beginLoading, isLoading: loading } = useInstanceLoading(path)

  const instanceLock: Record<string, Mutex> = {}

  async function update(
    version: InstanceResolveVersion | undefined,
    jres: JavaRecord[] = javas.value,
  ) {
    if (!version) return
    const loadingInstance = version.instance
    const endLoading = beginLoading(loadingInstance)
    abortController.abort()
    abortController = new AbortController()
    const timeStart = performance.now()
    try {
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
          // getInstallInstruction can fail when the version is left in an
          // inconsistent state — e.g. the user killed the install/download
          // task mid-way, leaving a partially written or corrupted version.
          // Without a fallback, instruction stays undefined and the launch
          // button's `transition` flag keeps it loading forever. Fall back to a
          // base (unresolved) instruction so the button recovers and the user
          // can retry the install.
          console.error('Failed to compute install instruction', e)
          if (version.instance === path.value) {
            instruction.value = markRaw({
              instance: version.instance,
              runtime: { ...version.requirements },
              version: version.version,
            })
          }
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
      endLoading()
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

    const issue = await diagnose({ version: resolved.id, side: 'client' })
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
      const version = await install(
        instruction.runtime,
        instruction.instance,
        instruction.version,
      )
      if (version !== instruction.resolvedVersion) {
        await commit(version)
      }
      if (instruction.assetsIndex) {
        refreshResolvedVersion()
      }
    } catch (e) {
      const err = e as Error
      const code = (typeof e === 'object' && e && 'code' in e && typeof e.code === 'string') ? e.code : undefined
      const isPermissionError = code === 'EPERM' || code === 'EACCES'
      const isDiskFull = code === 'ENOSPC'
      const isDownloadFailure = isDownloadError(e)
      // The main process never replied to a `service-call` IPC invoke even
      // though this renderer is still alive to catch the rejection. That means
      // the IPC bridge to the backend is broken - nothing else in the launcher
      // will work either, and retrying the install in place cannot recover it.
      // The only real fix is to relaunch, so we surface a clear "please restart"
      // hint instead of a generic install-failed toast.
      const isBackendUnresponsiveError = (err?.message?.includes('reply was never sent') ?? false) ||
        (err?.message?.includes('render frame was disposed') ?? false)

      // Only report unknown failures to telemetry. Environment errors
      // (anti-virus, disk full, broken network) are not bugs and otherwise
      // generate per-user storms - the user already gets a clear toast below.
      if (err.name && !isPermissionError && !isDiskFull && !isDownloadFailure) {
        if (isBackendUnresponsiveError) {
          // Otherwise reported as a generic 'Error'. Give it a distinct,
          // searchable name so the broken-IPC signal is not silently lumped
          // together with genuine install bugs.
          err.name = 'LauncherBackendUnresponsiveError'
        } else if (err.name === 'Error') {
          err.name = 'InstallInstallInstructionError'
        }
        appInsights.trackException({ exception: err })
      }

      // Always tell the user *something* went wrong. Previously only EPERM
      // produced a (hard-coded English) notification; every other install
      // failure was silently swallowed and the user just saw the install
      // button keep failing with no explanation.
      if (isBackendUnresponsiveError) {
        notify({
          title: t('errors.InstallBackendUnresponsive.title'),
          body: t('errors.InstallBackendUnresponsive.body'),
          level: 'error',
        })
      } else if (isPermissionError) {
        notify({
          title: t('errors.InstallPermissionDenied.title'),
          body: t('errors.InstallPermissionDenied.body'),
          level: 'error',
        })
      } else if (isDiskFull) {
        notify({
          title: t('errors.DiskIsFull'),
          level: 'error',
        })
      } else if (isDownloadFailure) {
        // Download failures remain visible and actionable in the task manager.
      } else {
        notify({
          title: t('errors.InstallInstructionFailed.title'),
          body: t('errors.InstallInstructionFailed.body', { name: err?.name ?? 'Error', message: err?.message ?? '' }),
          level: 'error',
        })
      }
    }
  }

  const fixingInstance = shallowRef<Record<string, boolean>>({})
  function isInstanceFixing(path: string) {
    return fixingInstance.value[path] === true
  }

  async function fix(instancePath = path.value) {
    const inst = instruction.value
    if (!inst || inst.instance !== instancePath) {
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
      await lock.runExclusive(() => handleInstallInstruction(inst)).catch(() => {})
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

  async function installRuntime(instancePath: string, runtime: RuntimeVersions) {
    const lock = getInstanceLock(instancePath)
    return lock.runExclusive(async () => {
      const version = await install(runtime, instancePath)
      await editInstance({
        instancePath,
        runtime,
        version,
      })
      return version
    })
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
    loading,
    getInstanceLock,
    isInstanceFixing,

    getInstallInstruction,
    handleInstallInstruction,

    install,
    installRuntime,
    installServer,
  }
}
