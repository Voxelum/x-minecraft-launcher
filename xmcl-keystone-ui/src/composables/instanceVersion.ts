import type { ResolvedVersion, VersionParseError } from '@xmcl/core'
import { findMatchedVersion, getResolvedVersionHeader, Instance, InstanceServiceKey, RuntimeVersions, ServerVersionHeader, VersionHeader, VersionServiceKey } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useRefreshable } from './refreshable'
import { useService } from './service'

export const kInstanceVersion: InjectionKey<ReturnType<typeof useInstanceVersion>> = Symbol('InstanceVersion')

export interface UnresolvedVersion {
  instance: string
  requirements: RuntimeVersions
  version: string
}

export type InstanceResolveVersion = UnresolvedVersion | (ResolvedVersion & UnresolvedVersion)

export function isResolvedVersion(v?: InstanceResolveVersion): v is (ResolvedVersion & UnresolvedVersion) {
  return !!v && 'id' in v
}

export function useInstanceVersion(instance: Ref<Instance>, local: Ref<VersionHeader[]>, servers: Ref<ServerVersionHeader[]>) {
  const versionHeader = computed(() => {
    if (!instance.value.path) {
      return undefined
    }
    return findMatchedVersion(local.value,
      instance.value.version,
      instance.value.runtime.minecraft,
      instance.value.runtime.forge,
      instance.value.runtime.neoForged,
      instance.value.runtime.fabricLoader,
      instance.value.runtime.optifine,
      instance.value.runtime.quiltLoader,
      instance.value.runtime.labyMod)
  })

  const serverVersionHeader = computed(() => {
    const runtime = instance.value.runtime
    return getServerHeader(runtime)
  })

  const { resolveLocalVersion } = useService(VersionServiceKey)

  async function getResolvedVersion(versionHeader: VersionHeader | undefined, version?: string) {
    let id: string | undefined
    if (!versionHeader) {
      if (!version) {
        return undefined
      } else {
        id = version
      }
    } else {
      id = versionHeader.id
    }
    try {
      const resolvedVersion = await resolveLocalVersion(id)
      return resolvedVersion
    } catch (e) {
      const err = e as VersionParseError
      if (err.name === 'MissingVersionJson') {
        return undefined
      }
      throw e
    }
  }

  const resolvedVersion = ref<InstanceResolveVersion | undefined>(undefined)
  const { editInstance } = useService(InstanceServiceKey)
  const { refreshing: isValidating, refresh: mutate, error } = useRefreshable<Instance>(async (i) => {
    const _path = i.path
    if (!_path) {
      return undefined
    }

    const header = findMatchedVersion(local.value,
      i.version,
      i.runtime.minecraft,
      i.runtime.forge,
      i.runtime.neoForged,
      i.runtime.fabricLoader,
      i.runtime.optifine,
      i.runtime.quiltLoader,
      instance.value.runtime.labyMod)

    const _version = i.version
    console.time('[resolveVersion]')
    const version = await getResolvedVersion(header, _version)
    console.timeEnd('[resolveVersion]')
    if (instance.value.version !== _version ||
      header !== versionHeader.value ||
      _path !== instance.value.path) {
      return
    }
    if (version) {
      const computedHeader = getResolvedVersionHeader(version)
      const rt = instance.value.runtime
      const expectRt = {
        minecraft: computedHeader.minecraft,
        forge: computedHeader.forge,
        neoForged: computedHeader.neoForged,
        fabricLoader: computedHeader.fabric,
        optifine: computedHeader.optifine,
        quiltLoader: computedHeader.quilt,
        labyMod: computedHeader.labyMod,
      }
      if (expectRt.minecraft !== rt.minecraft ||
        expectRt.forge !== rt.forge ||
        expectRt.neoForged !== rt.neoForged ||
        expectRt.fabricLoader !== rt.fabricLoader ||
        expectRt.optifine !== rt.optifine ||
        expectRt.quiltLoader !== rt.quiltLoader ||
        expectRt.labyMod !== rt.labyMod
      ) {
        console.warn(`The instance ${_path}'s runtime ${JSON.stringify(rt, (k, v) => !v ? undefined : v)} is mismatched with it's version ${version.id} ${JSON.stringify(expectRt, (k, v) => !v ? undefined : v)}.`)
        editInstance({
          instancePath: _path,
          runtime: expectRt,
        })
      }
    }

    const unresolvedVersion: UnresolvedVersion = { requirements: { ...instance.value.runtime }, version: _version, instance: _path }

    resolvedVersion.value = version
      ? { ...version, ...unresolvedVersion }
      : unresolvedVersion
  })

  // update on instance/instance version/versions changed
  watch([versionHeader, local, instance], () => {
    mutate(instance.value)
  }, { deep: true })

  const serverVersionId = computed(() => serverVersionHeader.value?.id)
  const versionId = computed(() => versionHeader.value?.id)

  function getVersionHeader(runtime: RuntimeVersions, version = instance.value.version) {
    if (!instance.value.path) {
      return undefined
    }
    return findMatchedVersion(local.value,
      version,
      runtime.minecraft,
      runtime.forge,
      runtime.neoForged,
      runtime.fabricLoader,
      runtime.optifine,
      runtime.quiltLoader,
      runtime.labyMod)
  }

  function getServerHeader(runtime: RuntimeVersions) {
    const onlyMinecraft = Object.entries(runtime).filter(([k, v]) => k !== 'minecraft' && !!v).length === 0
    for (const s of servers.value) {
      if (s.minecraft !== runtime.minecraft) {
        continue
      }
      if (runtime.forge) {
        if (s.version === runtime.forge && s.type === 'forge') {
          return s
        }
      }
      if (runtime.fabricLoader) {
        if (s.version === runtime.fabricLoader && s.type === 'fabric') {
          return s
        }
      }
      if (runtime.neoForged) {
        if (s.version === runtime.neoForged && s.type === 'neoforge') {
          return s
        }
      }
      if (runtime.quiltLoader) {
        if (s.version === runtime.quiltLoader && s.type === 'quilt') {
          return s
        }
      }
      if (s.type === 'vanilla' && onlyMinecraft) {
        return s
      }
    }
    return undefined
  }

  return {
    getVersionHeader,
    getServerHeader,
    getResolvedVersion,
    versionId,
    serverVersionId,
    versionHeader,
    serverVersionHeader,
    error,
    isValidating,
    resolvedVersion,
  }
}
