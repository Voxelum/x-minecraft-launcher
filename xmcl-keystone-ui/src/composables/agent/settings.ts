import { createSharedComposable, useLocalStorage } from '@vueuse/core'
import { DEFAULT_AGNES_ENDPOINT, DEFAULT_AGNES_MODEL } from './llm'

/**
 * Agent settings are a shared singleton: the settings page and the agent
 * session must read/write the SAME refs (including the derived `computed`
 * wrappers below), so editing the key in Settings immediately updates the
 * live agent's `available` state.
 */
export const useAgentSettings = createSharedComposable(() => {
  const apiKey = useLocalStorage('agentApiKey', '')
  // Default values are Agnes endpoint/model; users can still override both.
  const endpoint = useLocalStorage('agentEndpoint', DEFAULT_AGNES_ENDPOINT)
  const model = useLocalStorage('agentModel', DEFAULT_AGNES_MODEL)

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
