import type { ResolvedVersion, VersionParseError } from '@xmcl/core'
import { Instance, LocalVersionHeader, RuntimeVersions, ServerVersionHeader, VersionServiceKey, getResolvedVersion } from '@xmcl/runtime-api'
import useSWRV from 'swrv'
import { InjectionKey, Ref } from 'vue'
import { useService } from './service'

function useInstanceVersionBase(instance: Ref<Instance>) {
  const minecraft = computed(() => instance.value.runtime.minecraft)
  const forge = computed(() => instance.value.runtime.forge)
  const fabricLoader = computed(() => instance.value.runtime.fabricLoader)
  const quiltLoader = computed(() => instance.value.runtime.quiltLoader)
  return {
    minecraft,
    forge,
    fabricLoader,
    quiltLoader,
  }
}
export const kInstanceVersion: InjectionKey<ReturnType<typeof useInstanceVersion>> = Symbol('InstanceVersion')

export interface UnresolvedVersion {
  requirements: RuntimeVersions
}

export type InstanceResolveVersion = UnresolvedVersion | ResolvedVersion

export function isResolvedVersion(v?: InstanceResolveVersion): v is ResolvedVersion {
  return !!v && 'id' in v
}

export function useInstanceVersion(instance: Ref<Instance>, local: Ref<LocalVersionHeader[]>, servers: Ref<ServerVersionHeader[]>) {
  const { resolveLocalVersion } = useService(VersionServiceKey)
  const versionHeader = computed(() => {
    let result: LocalVersionHeader | undefined
    if (instance.value.path) {
      result = getResolvedVersion(local.value,
        instance.value.version,
        instance.value.runtime.minecraft,
        instance.value.runtime.forge,
        instance.value.runtime.neoForged,
        instance.value.runtime.fabricLoader,
        instance.value.runtime.optifine,
        instance.value.runtime.quiltLoader,
        instance.value.runtime.labyMod)
    }
    return result
  })

  const { isValidating, mutate, data: resolvedVersion, error } = useSWRV(() => instance.value.path && `/instance/${instance.value.path}/version`, async () => {
    console.log('update instance version')
    if (!instance.value.path) {
      return undefined
    }
    if (!versionHeader.value?.path) {
      return { requirements: { ...instance.value.runtime } }
    }
    try {
      const resolvedVersion = await resolveLocalVersion(versionHeader.value.id)
      return resolvedVersion
    } catch (e) {
      const err = e as VersionParseError
      if (err.name === 'MissingVersionJson') {
        return { requirements: { ...instance.value.runtime } }
      }
      throw e
    }
  }, { revalidateOnFocus: false, errorRetryCount: 0, shouldRetryOnError: false })

  const serverVersionHeader = computed(() => {
    const runtime = instance.value.runtime
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
  })

  const serverVersionId = computed(() => serverVersionHeader.value?.id)
  const versionId = computed(() => versionHeader.value?.id)

  watch([versionHeader, local], () => {
    mutate()
  }, { deep: true })

  return {
    ...useInstanceVersionBase(instance),
    error,
    versionId,
    serverVersionId,
    versionHeader,
    serverVersionHeader,
    resolvedVersion,
    isValidating,
  }
}
