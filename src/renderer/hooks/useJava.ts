import { JavaRecord } from '/@shared/entities/java'
import { computed } from '@vue/composition-api'
import { useService } from './useService'
import { useStore } from './useStore'
import { useBusy } from './useSemaphore'
import { JavaServiceKey } from '/@shared/services/JavaService'
import { BaseServiceKey } from '/@shared/services/BaseService'

export function useJava () {
  const { state, getters, commit } = useStore()
  const { resolveJava, installDefaultJava: installJava, refreshLocalJava } = useService(JavaServiceKey)
  const { openInBrowser } = useService(BaseServiceKey)
  const all = computed(() => state.java.all)
  const defaultJava = computed(() => state.java.all.find(j => j.majorVersion === 8) ?? state.java.all[0])
  const missing = computed(() => getters.missingJava)
  const refreshing = useBusy('java')
  function remove (java: JavaRecord) {
    commit('javaRemove', java)
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
