import { createSharedComposable } from '@vueuse/core'
import {
  AGENT_PROVIDER_PRESETS,
  AgentServiceKey,
  CUSTOM_AGENT_PROVIDER_ID,
  DEFAULT_AGENT_ENDPOINT,
  DEFAULT_AGENT_MODEL,
  getAgentProviderPreset,
  resolveAgentProviderId,
} from '@xmcl/runtime-api'
import { useService } from '../service'

const DEFAULT_AGNES_ENDPOINT = DEFAULT_AGENT_ENDPOINT
const DEFAULT_AGNES_MODEL = DEFAULT_AGENT_MODEL

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
  let keyTimer: ReturnType<typeof setTimeout> | undefined
  let keySave = Promise.resolve()
  let settingsSave = Promise.resolve()

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

  function saveProviderSettings() {
    settingsSave = settingsSave.then(async () => {
      await service.setProviderSettings({ endpoint: endpoint.value, model: model.value })
    })
    return settingsSave
  }

  watch([endpoint, model], () => {
    if (!loaded.value) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(async () => {
      saveTimer = undefined
      await saveProviderSettings()
    }, 300)
  })

  async function flush() {
    await ready
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = undefined
      await saveProviderSettings()
    } else {
      await settingsSave
    }
  }

  async function setApiKey(value: string) {
    apiKey.value = value
    await ready
    // Capture the endpoint at call time. If the user switches provider while this
    // write is queued behind an earlier one, the key must still be filed under the
    // provider it was typed for -- and must not resurrect settings for that
    // provider over the newly selected one.
    const target = endpoint.value
    const targetModel = model.value
    keySave = keySave.then(async () => {
      try {
        await service.setProviderSettings({ endpoint: target, model: targetModel, apiKey: value })
        // Only reflect the result in the UI if that provider is still selected.
        if (endpoint.value === target) {
          configured.value = !!value.trim()
          error.value = ''
        } else {
          // The endpoint just committed belongs to the previous provider; restore
          // the current selection so settings and UI do not drift apart.
          await service.setProviderSettings({ endpoint: endpoint.value, model: model.value })
        }
      } catch (e) {
        if (endpoint.value === target) error.value = e instanceof Error ? e.message : String(e)
      }
    })
    await keySave
  }

  /**
   * Debounced key entry. The debounce lives here rather than in the view so that a
   * provider switch can cancel a still-pending write: otherwise a key typed for the
   * previous provider would land under the newly selected one.
   */
  function updateApiKey(value: string) {
    apiKey.value = value
    if (keyTimer) clearTimeout(keyTimer)
    keyTimer = setTimeout(() => {
      keyTimer = undefined
      void setApiKey(value)
    }, 500)
  }

  function cancelPendingApiKey() {
    if (!keyTimer) return
    clearTimeout(keyTimer)
    keyTimer = undefined
  }

  /**
   * Forget the stored key for the currently selected provider. Writing an empty
   * value deletes the secret rather than storing a blank one. Any pending
   * debounced write is cancelled first, so a key typed moments earlier cannot
   * land after the clear and silently resurrect it.
   */
  async function clearApiKey() {
    cancelPendingApiKey()
    await setApiKey('')
  }

  const resolvedEndpoint = computed(() => endpoint.value.trim() || DEFAULT_AGNES_ENDPOINT)
  const resolvedModel = computed(() => model.value.trim() || DEFAULT_AGNES_MODEL)

  /** The preset matching the current endpoint, or the custom id when none matches. */
  const providerId = computed(() => resolveAgentProviderId(resolvedEndpoint.value))
  const provider = computed(() => getAgentProviderPreset(providerId.value))
  /** True when the selected provider needs no API key at all. */
  const keyless = computed(() => !!provider.value?.keyless)

  /**
   * API keys are stored per provider and never read back into the renderer, so on a
   * provider switch the input is cleared and `configured` is re-read for the newly
   * selected provider. The endpoint must be persisted first, since the backend keys
   * the secret off the saved endpoint.
   */
  let refreshToken = 0
  watch(providerId, () => {
    if (!loaded.value) return
    cancelPendingApiKey()
    apiKey.value = ''
    configured.value = false
    const token = ++refreshToken
    // Wait for any key write that was already in flight: it commits the previous
    // provider's endpoint, so reading `configured` before it settles would report
    // the wrong provider's state.
    void keySave.then(() => flush()).then(async () => {
      const settings = await service.getProviderSettings()
      // Ignore a stale response if the user switched again while this was in flight.
      if (token === refreshToken) configured.value = settings.configured
    }).catch(e => {
      if (token === refreshToken) error.value = e instanceof Error ? e.message : String(e)
    })
  })

  /**
   * Switch to a preset provider. The endpoint always follows the preset; the model
   * only follows when it is empty or still the previous preset's default, so a model
   * the user typed by hand is never silently discarded.
   */
  function selectProvider(id: string) {
    if (id === CUSTOM_AGENT_PROVIDER_ID) return
    const preset = getAgentProviderPreset(id)
    if (!preset || preset.id === providerId.value) return
    const previous = provider.value
    const current = model.value.trim()
    if (!current || current === previous?.defaultModel) model.value = preset.defaultModel
    endpoint.value = preset.endpoint
  }

  return {
    apiKey,
    endpoint,
    model,
    configured,
    loaded,
    error,
    ready,
    flush,
    setApiKey,
    updateApiKey,
    clearApiKey,
    resolvedEndpoint,
    resolvedModel,
    providers: AGENT_PROVIDER_PRESETS,
    providerId,
    provider,
    keyless,
    selectProvider,
  }
})
