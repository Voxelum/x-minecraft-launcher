import { EMPTY_VERSION, Instance, LocalVersionHeader, RuntimeVersions, VersionServiceKey, getExpectVersion, getResolvedVersion } from '@xmcl/runtime-api'
import useSWRV from 'swrv'
import { Ref, InjectionKey } from 'vue'
import { useService } from './service'
import type { ResolvedVersion, VersionParseError } from '@xmcl/core'

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

export function useInstanceVersion(instance: Ref<Instance>, local: Ref<LocalVersionHeader[]>) {
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
    if (!result) {
      result = { ...EMPTY_VERSION, id: getExpectVersion(instance.value.runtime) }
    }
    return result
  })
  const folder = computed(() => versionHeader.value.id)

  const { isValidating, mutate, data: resolvedVersion, error } = useSWRV(() => instance.value.path && `/instance/${instance.value.path}/version`, async () => {
    console.log('update instance version')
    if (!instance.value.path) {
      return undefined
    }
    if (!versionHeader.value.path) {
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

  watch([versionHeader, local], () => {
    mutate()
  }, { deep: true })

  return {
    ...useInstanceVersionBase(instance),
    folder,
    error,
    versionHeader,
    resolvedVersion,
    isValidating,
  }
}
