import { useRefreshable, useService } from '@/composables'
import { mergeJavaUpdate, sortJavaRecords } from '@/util/javaState'
import { JavaRecord, JavaServiceKey, JavaState } from '@xmcl/runtime-api'
import { computed, InjectionKey } from 'vue'
import { DialogKey } from './dialog'
import { useState } from './syncableState'
import { BuiltinImages } from '@/constant'

export const javaVendors = [
  {
    title: 'Mojang',
    uid: 'net.minecraft.java',
    icon: BuiltinImages.mojang,
  },
  {
    title: 'Adoptium',
    uid: 'net.adoptium.java',
    icon: BuiltinImages.adoptium,
  },
  {
    title: 'Azul Zulu',
    uid: 'com.azul.java',
    icon: BuiltinImages.azul,
  },
  {
    title: 'IBM Semeru',
    uid: 'com.ibm.java',
    icon: BuiltinImages.ibmSemeru,
  },
]

export const JavaIssueDialogKey: DialogKey<void> = 'java-issue'
export const kJavaContext: InjectionKey<ReturnType<typeof useJavaContext>> = Symbol('JavaContext')

/**
 * Renderer-side override of `JavaState` that mirrors the {@link InstanceState}
 * pattern: every mutation that observably changes `all` must produce a brand
 * new array reference, so Vue's reactivity actually notifies the downstream
 * `watch([all, ...])` in `useInstanceJava`.
 *
 * The base class (used by the preload to apply mutations) does this in place,
 * which means installing a new Java or refreshing one's metadata used to
 * leave the instance's auto-Java selection stale until the user navigated
 * away and back. See `util/javaState.ts` for the merge helper + its tests.
 */
class ReactiveJavaState extends JavaState {
  override javaUpdate(java: JavaRecord | JavaRecord[]) {
    this.all = mergeJavaUpdate(this.all, java)
  }
}

export function useJavaContext() {
  const { getJavaState, setJavaSettings, removeJava } = useService(JavaServiceKey)
  const { state, isValidating, error } = useState(getJavaState, ReactiveJavaState)
  const records = computed(() => state.value?.all)
  const all = computed(() => sortJavaRecords(records.value ?? []))
  const missing = computed(() => state.value?.all.length === 0)

  const { refreshLocalJava } = useService(JavaServiceKey)
  const { refreshing, refresh, error: refreshError } = useRefreshable(refreshLocalJava)

  return {
    isValidating,
    missing,
    all,
    error,
    update: (java: JavaRecord, prependCommand?: string, vmOptions?: string[]) => {
      setJavaSettings(java.path, prependCommand, vmOptions)
    },
    remove: async (java: JavaRecord, attemptUninstall: boolean = false) => {
      await removeJava(java.path, attemptUninstall)
    },
    refresh: (v?: boolean) => refresh(v),
    refreshing,
    refreshError,
  }
}
