import { AutoDetectedJava, JavaCompatibleState, JavaRecord, JavaServiceKey, getAutoOrManuallJava, getAutoSelectedJava } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { InstanceResolveVersion } from './instanceVersion'
import { useRefreshable } from './refreshable'
import { useService } from './service'
import { Instance } from '@xmcl/instance'

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

  const data: Ref<InstanceJavaStatus | undefined> = shallowRef(undefined)
  // Monotonic generation: every call to `mutate()` claims the next id, and
  // only the call whose id matches `latestToken` at completion time is
  // allowed to commit. This is a stricter guard than the previous
  // field-by-field comparison, which missed in-place mutations to `all`
  // (`JavaState.javaUpdate` push/edit kept the same array reference, so
  // `all.value !== _all` was always false even when Java was added).
  let latestToken = 0
  const { refresh: mutate, refreshing: isValidating, error } = useRefreshable(async () => {
    const myToken = ++latestToken
    const _version = version.value
    const inst = instance.value
    const path = inst.path
    if (_version && _version.instance !== path) {
      // Resolver is racing a not-yet-loaded version for a different
      // instance; skip without clobbering the current data.
      return
    }
    const result = await getInstanceJavaStatus(_version, inst)
    if (myToken !== latestToken) {
      // A newer `mutate()` superseded us while we were awaiting the
      // resolver — discard rather than overwriting a fresher snapshot.
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

  // Only the fields that actually feed selection matter; watching the whole
  // `runtime` object with { deep: true } makes every unrelated edit
  // (mod loader switch, optifine tweak, etc.) re-run the resolver and race
  // with in-flight launch compatibility checks.
  watch([
    all,
    version,
    computed(() => instance.value.java),
    computed(() => instance.value.runtime.minecraft),
    computed(() => instance.value.runtime.forge),
  ], () => {
    mutate()
  })

  return {
    java,
    status: data,
    isValidating,
    getInstanceJavaStatus,
    getComputedJava,
    error,
  }
}
