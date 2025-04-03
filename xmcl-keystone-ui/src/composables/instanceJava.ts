import { AutoDetectedJava, Instance, JavaCompatibleState, JavaRecord, JavaServiceKey, getAutoOrManuallJava, getAutoSelectedJava } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { InstanceResolveVersion } from './instanceVersion'
import { useRefreshable } from './refreshable'
import { useService } from './service'

export { JavaCompatibleState }

export const kInstanceJava: InjectionKey<ReturnType<typeof useInstanceJava>> = Symbol('InstanceJava')

export interface InstanceJavaStatus extends AutoDetectedJava {
  instance: string
  /**
   * The selected java path of the instance
   */
  javaPath: string | undefined
  /**
   * Only present when user has manually selected java
   */
  compatible?: JavaCompatibleState
  /**
   * The java preferred and auto detected by the system
   */
  preferredJava?: JavaRecord
}

export function useInstanceJava(instance: Ref<Instance>, version: Ref<InstanceResolveVersion | undefined>, all: Ref<JavaRecord[]>) {
  const { resolveJava } = useService(JavaServiceKey)

  const data: Ref<InstanceJavaStatus | undefined> = ref(undefined)
  const { refresh: mutate, refreshing: isValidating, error } = useRefreshable(async () => {
    const _version = version.value
    const inst = instance.value
    const _all = all.value

    const path = inst.path
    const javaPath = inst.java
    const minecraft = inst.runtime.minecraft
    const forge = inst.runtime.forge
    data.value = undefined
    if (version.value && version.value.instance !== path) {
      return
    }
    const result = await getInstanceJavaStatus(_version, inst)
    if (version.value !== _version ||
      instance.value.java !== javaPath ||
      instance.value.runtime.minecraft !== minecraft ||
      instance.value.runtime.forge !== forge ||
      all.value !== _all) {
      return
    }
    data.value = result
  })

  function getComputedJava(instance: Instance, version: InstanceResolveVersion | undefined) {
    return getAutoSelectedJava(
      all.value,
      instance.runtime.minecraft,
      instance.runtime.forge,
      version,
    )
  }

  async function getInstanceJavaStatus(version: InstanceResolveVersion | undefined, inst: Instance) {
    const javaPath = inst.java
    const instPath = inst.path
    const detected = getComputedJava(inst, version)
    const result = await getAutoOrManuallJava(detected, resolveJava, javaPath)
    const status: InstanceJavaStatus = {
      instance: instPath,
      javaPath,
      ...result.auto,
      java: result.java || result.auto.java,
      compatible: result.quality,
      preferredJava: result.auto.java,
    }
    return status
  }

  const java = computed(() => data.value?.java)

  watch([all, version, computed(() => instance.value.java), computed(() => instance.value.runtime)], () => {
    mutate()
  }, { deep: true })

  return {
    java,
    status: data,
    isValidating,
    getInstanceJavaStatus,
    getComputedJava,
    error,
  }
}
