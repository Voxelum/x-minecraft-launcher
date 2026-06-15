import { useRefreshable, useService } from '@/composables'
import { mergeJavaUpdate } from '@/util/javaState'
import { JavaRecord, JavaServiceKey, JavaState } from '@xmcl/runtime-api'
import { computed, InjectionKey } from 'vue'
import { DialogKey } from './dialog'
import { useState } from './syncableState'

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
  const { getJavaState, removeJava } = useService(JavaServiceKey)
  const { state, isValidating, error } = useState(getJavaState, ReactiveJavaState)
  const all = computed(() => state.value?.all ?? [])
  const missing = computed(() => state.value?.all.length === 0)

  const { refreshLocalJava } = useService(JavaServiceKey)
  const { refreshing, refresh } = useRefreshable(refreshLocalJava)

  return {
    isValidating,
    missing,
    all,
    error,
    remove: (java: JavaRecord) => {
      removeJava(java.path)
    },
    refresh: (v?: boolean) => refresh(v),
    refreshing,
  }
}
