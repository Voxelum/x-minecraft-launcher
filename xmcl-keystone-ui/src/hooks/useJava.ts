import { computed } from '@vue/composition-api'
import { BaseServiceKey, JavaRecord, JavaServiceKey } from '@xmcl/runtime-api'
import { useBusy } from './useSemaphore'
import { useService } from './useService'

export function useJavaService() {
  return useService(JavaServiceKey)
}

export function useJava() {
  const { state, resolveJava, installDefaultJava: installJava, refreshLocalJava } = useJavaService()
  const { openInBrowser } = useService(BaseServiceKey)
  const all = computed(() => state.all)
  const defaultJava = computed(() => state.all.find(j => j.majorVersion === 8) ?? state.all[0])
  const missing = computed(() => state.missingJava)
  const refreshing = useBusy('java()')
  function remove(java: JavaRecord) {
    state.javaRemove(java)
  }

  return {
    all,
    remove,
    default: defaultJava,
    add: resolveJava,
    installDefault: installJava,
    refreshLocalJava,
    refreshing,
    missing,
    openJavaSite: () => openInBrowser('https://www.java.com/download/'),
  }
}
