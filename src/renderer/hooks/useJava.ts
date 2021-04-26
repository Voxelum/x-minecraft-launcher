import { computed } from '@vue/composition-api'
import { useBusy } from './useSemaphore'
import { useService } from './useService'
import { JavaRecord } from '/@shared/entities/java'
import { BaseServiceKey } from '/@shared/services/BaseService'
import { JavaServiceKey } from '/@shared/services/JavaService'

export function useJavaServie() {
  return useService(JavaServiceKey)
}

export function useJava() {
  const { state, resolveJava, installDefaultJava: installJava, refreshLocalJava } = useJavaServie()
  const { openInBrowser } = useService(BaseServiceKey)
  const all = computed(() => state.all)
  const defaultJava = computed(() => state.all.find(j => j.majorVersion === 8) ?? state.all[0])
  const missing = computed(() => state.missingJava)
  const refreshing = useBusy('java')
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
