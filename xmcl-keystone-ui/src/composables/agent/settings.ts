import { createSharedComposable } from '@vueuse/core'
import { useLocalStorageCacheStringValue } from '../cache'
import { DEFAULT_AGNES_ENDPOINT, DEFAULT_AGNES_MODEL } from './llm'

/**
 * Agent settings are a shared singleton: the settings page and the agent
 * session must read/write the SAME refs. `useLocalStorageCache` creates a
 * fresh ref per call and the same-window `storage` event never fires, so
 * without sharing, editing the key in Settings would never update the live
 * agent's `available` state.
 */
export const useAgentSettings = createSharedComposable(() => {
  const apiKey = useLocalStorageCacheStringValue<string>('agentApiKey', '')
  // Default values are Agnes endpoint/model; users can still override both.
  const endpoint = useLocalStorageCacheStringValue<string>('agentEndpoint', DEFAULT_AGNES_ENDPOINT)
  const model = useLocalStorageCacheStringValue<string>('agentModel', DEFAULT_AGNES_MODEL)

  const resolvedEndpoint = computed(() => {
    const raw = endpoint.value.trim()
    if (raw) return raw
    return DEFAULT_AGNES_ENDPOINT
  })

  const resolvedModel = computed(() => {
    const raw = model.value.trim()
    if (raw) return raw
    return DEFAULT_AGNES_MODEL
  })

  return {
    apiKey,
    endpoint,
    model,
    resolvedEndpoint,
    resolvedModel,
  }
})
