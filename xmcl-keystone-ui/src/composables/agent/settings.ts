import { createSharedComposable } from '@vueuse/core'
import {
  AGENT_PROVIDER_PRESETS,
  AgentServiceKey,
  BUILTIN_AGENT_ENDPOINT,
  BUILTIN_AGENT_MODEL,
  BUILTIN_AGENT_PROVIDER_ID,
  CUSTOM_AGENT_PROVIDER_ID,
  DEFAULT_AGENT_PROVIDER,
  getAgentProviderPreset,
  resolveAgentProviderId,
} from '@xmcl/runtime-api'
import { kXmclAccount } from '../xmclAccount'
import { useService } from '../service'

const LEGACY_API_KEY = 'agentApiKey'
const LEGACY_ENDPOINT = 'agentEndpoint'
const LEGACY_MODEL = 'agentModel'

export const useAgentSettings = createSharedComposable(() => {
  const service = useService(AgentServiceKey)
  const xmclAccount = inject(kXmclAccount, undefined)
  const apiKey = ref('')
  const endpoint = ref('')
  const model = ref('')
  const providerConfigured = ref(false)
  const mode = computed<'builtin' | 'custom'>(() => endpoint.value.trim() && model.value.trim() ? 'custom' : 'builtin')
  const loaded = ref(false)
  const error = ref('')
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  let keyTimer: ReturnType<typeof setTimeout> | undefined
  let pendingApiKey = ''
  let keySave = Promise.resolve()
  let keySaveError: Error | undefined
  let settingsSave = Promise.resolve()

  async function refreshStatus() {
    const settings = await service.getProviderSettings()
    providerConfigured.value = settings.configured
  }

  const ready = (async () => {
    const legacyApiKey = localStorage.getItem(LEGACY_API_KEY) ?? ''
    const legacyEndpoint = localStorage.getItem(LEGACY_ENDPOINT) ?? ''
    const legacyModel = localStorage.getItem(LEGACY_MODEL) ?? ''
    let settings = await service.getProviderSettings()
    if (legacyApiKey || legacyEndpoint || legacyModel) {
      const migrateToExternal = !!legacyApiKey && !legacyEndpoint && !settings.endpoint
      await service.setProviderSettings({
        endpoint: legacyEndpoint || settings.endpoint || (migrateToExternal ? DEFAULT_AGENT_PROVIDER.endpoint : ''),
        model: legacyModel || settings.model || (migrateToExternal ? DEFAULT_AGENT_PROVIDER.defaultModel : ''),
        apiKey: legacyApiKey || undefined,
      })
      localStorage.removeItem(LEGACY_API_KEY)
      localStorage.removeItem(LEGACY_ENDPOINT)
      localStorage.removeItem(LEGACY_MODEL)
      settings = await service.getProviderSettings()
    }
    endpoint.value = settings.endpoint
    model.value = settings.model
    providerConfigured.value = settings.configured
    loaded.value = true
  })()

  function saveProviderSettings() {
    settingsSave = settingsSave.then(async () => {
      await service.setProviderSettings({ endpoint: endpoint.value, model: model.value })
      await refreshStatus()
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
    }
    if (keyTimer) {
      clearTimeout(keyTimer)
      keyTimer = undefined
      await setApiKey(pendingApiKey)
    }
    await Promise.all([settingsSave, keySave])
    if (keySaveError) throw keySaveError
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
          await refreshStatus()
          keySaveError = undefined
          error.value = ''
        } else {
          // The endpoint just committed belongs to the previous provider; restore
          // the current selection so settings and UI do not drift apart.
          await service.setProviderSettings({ endpoint: endpoint.value, model: model.value })
        }
      } catch (e) {
        keySaveError = e instanceof Error ? e : new Error(String(e))
        if (endpoint.value === target) error.value = keySaveError.message
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
    pendingApiKey = value
    if (keyTimer) clearTimeout(keyTimer)
    keyTimer = setTimeout(() => {
      keyTimer = undefined
      void setApiKey(pendingApiKey)
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

  const resolvedEndpoint = computed(() => mode.value === 'custom' ? endpoint.value.trim() : BUILTIN_AGENT_ENDPOINT)
  const resolvedModel = computed(() => mode.value === 'custom' ? model.value.trim() : BUILTIN_AGENT_MODEL)
  const configured = computed(() => {
    if (mode.value === 'custom' || !xmclAccount) return providerConfigured.value
    const session = xmclAccount.session.value
    return !!session && Date.parse(session.expiresAt) > Date.now()
  })

  /** The preset matching the current endpoint, or the custom id when none matches. */
  const providerId = computed(() => mode.value === 'builtin' ? BUILTIN_AGENT_PROVIDER_ID : resolveAgentProviderId(resolvedEndpoint.value))
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
    providerConfigured.value = false
    const token = ++refreshToken
    // Wait for any key write that was already in flight: it commits the previous
    // provider's endpoint, so reading `configured` before it settles would report
    // the wrong provider's state.
    void keySave.then(() => flush()).then(async () => {
      const settings = await service.getProviderSettings()
      // Ignore a stale response if the user switched again while this was in flight.
      if (token === refreshToken) providerConfigured.value = settings.configured
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
    if (id === BUILTIN_AGENT_PROVIDER_ID) {
      endpoint.value = ''
      model.value = ''
      return
    }
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
    mode,
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
