import { createSharedComposable } from '@vueuse/core'
import { AgentServiceKey } from '@xmcl/runtime-api'
import { useService } from '../service'

const DEFAULT_AGNES_ENDPOINT = 'https://apihub.agnes-ai.com/v1/chat/completions'
const DEFAULT_AGNES_MODEL = 'agnes-2.0-flash'

const LEGACY_API_KEY = 'agentApiKey'
const LEGACY_ENDPOINT = 'agentEndpoint'
const LEGACY_MODEL = 'agentModel'

export const useAgentSettings = createSharedComposable(() => {
  const service = useService(AgentServiceKey)
  const apiKey = ref('')
  const endpoint = ref(DEFAULT_AGNES_ENDPOINT)
  const model = ref(DEFAULT_AGNES_MODEL)
  const configured = ref(false)
  const loaded = ref(false)
  const error = ref('')
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  let keySave = Promise.resolve()

  const ready = (async () => {
    const legacyApiKey = localStorage.getItem(LEGACY_API_KEY) ?? ''
    const legacyEndpoint = localStorage.getItem(LEGACY_ENDPOINT) ?? ''
    const legacyModel = localStorage.getItem(LEGACY_MODEL) ?? ''
    let settings = await service.getProviderSettings()
    if (legacyApiKey || legacyEndpoint || legacyModel) {
      await service.setProviderSettings({
        endpoint: legacyEndpoint || settings.endpoint,
        model: legacyModel || settings.model,
        apiKey: legacyApiKey || undefined,
      })
      localStorage.removeItem(LEGACY_API_KEY)
      localStorage.removeItem(LEGACY_ENDPOINT)
      localStorage.removeItem(LEGACY_MODEL)
      settings = await service.getProviderSettings()
    }
    endpoint.value = settings.endpoint
    model.value = settings.model
    configured.value = settings.configured
    loaded.value = true
  })()

  watch([endpoint, model], () => {
    if (!loaded.value) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(async () => {
      await service.setProviderSettings({ endpoint: endpoint.value, model: model.value })
    }, 300)
  })

  async function setApiKey(value: string) {
    apiKey.value = value
    await ready
    keySave = keySave.then(async () => {
      try {
        await service.setProviderSettings({ endpoint: endpoint.value, model: model.value, apiKey: value })
        configured.value = !!value.trim()
        error.value = ''
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e)
      }
    })
    await keySave
  }

  const resolvedEndpoint = computed(() => endpoint.value.trim() || DEFAULT_AGNES_ENDPOINT)
  const resolvedModel = computed(() => model.value.trim() || DEFAULT_AGNES_MODEL)

  return {
    apiKey,
    endpoint,
    model,
    configured,
    loaded,
    error,
    ready,
    setApiKey,
    resolvedEndpoint,
    resolvedModel,
  }
})
