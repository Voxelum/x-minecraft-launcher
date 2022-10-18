import { computed } from 'vue'
import { BaseServiceKey, JavaRecord, JavaServiceKey } from '@xmcl/runtime-api'
import { DialogKey } from './dialog'
import { useServiceBusy, useService } from '@/composables'

export function useJavaService() {
  return useService(JavaServiceKey)
}

export const JavaIssueDialogKey: DialogKey<void> = 'java-issue'

export function useJava() {
  const { state, resolveJava, installDefaultJava: installJava, refreshLocalJava } = useJavaService()
  const { openInBrowser } = useService(BaseServiceKey)
  const all = computed(() => state.all)
  const missing = computed(() => state.missingJava)
  const refreshing = useServiceBusy(JavaServiceKey, 'refreshLocalJava')
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
