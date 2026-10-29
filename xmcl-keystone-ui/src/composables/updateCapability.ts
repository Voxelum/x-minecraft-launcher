import type { UpdateCapability } from '@xmcl/runtime-api'
import { computed, ref, type Ref } from 'vue'

/** Capability is independent of release metadata; no synthetic NEW/up-to-date state. */
export function useUpdateCapability(
  state: Ref<{ updateCapability?: UpdateCapability } | undefined>,
  checkUpdate: () => Promise<void>,
) {
  const updateStateReady = computed(() => state.value !== undefined)
  const updateUnavailable = computed(() => state.value?.updateCapability?.automatic === false)
  const updateCapabilityReason = computed(() => state.value?.updateCapability?.reason)
  const manualCheckRequested = ref(false)
  const checkingUpdate = ref(false)

  async function check() {
    if (!updateStateReady.value || checkingUpdate.value) return
    checkingUpdate.value = true
    try {
      if (updateUnavailable.value) {
        manualCheckRequested.value = true
        return
      }
      await checkUpdate()
    } finally {
      checkingUpdate.value = false
    }
  }

  return { updateStateReady, updateUnavailable, updateCapabilityReason, manualCheckRequested, checkingUpdate, checkUpdate: check }
}
