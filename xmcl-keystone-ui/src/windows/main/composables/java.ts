import { computed } from '@vue/composition-api'
import { BaseServiceKey, JavaRecord, JavaServiceKey } from '@xmcl/runtime-api'
import { useBusy, useService } from '/@/composables'

export function useJavaService() {
  return useService(JavaServiceKey)
}

export function useJava() {
  const { state, resolveJava, installDefaultJava: installJava, refreshLocalJava } = useJavaService()
  const { openInBrowser } = useService(BaseServiceKey)
  const all = computed(() => state.all)
  const missing = computed(() => state.missingJava)
  const refreshing = useBusy('java()')
  function remove(java: JavaRecord) {
    state.javaRemove(java)
  }

  return {
    all,
    remove,
    add: resolveJava,
    installDefault: installJava,
    refreshLocalJava,
    refreshing,
    missing,
    openJavaSite: () => openInBrowser('https://www.java.com/download/'),
  }
}
