import { createSharedComposable } from '@vueuse/core'
import { computed, onScopeDispose, ref, watch } from 'vue'
import {
  AgentServiceKey,
  type AgentService,
  type XmclAccountService,
  BUILTIN_AGENT_ENDPOINT,
  BUILTIN_AGENT_MODEL,
  XmclAccountServiceKey,
} from '@xmcl/runtime-api'
import { useService } from '../service'
import { hasActiveXmclSubscription } from './access'

export function createAgentSettings(service: AgentService, xmclAccountService: XmclAccountService) {
  const apiKey = ref('')
  const endpoint = ref('')
  const model = ref('')
  const providerConfigured = ref(false)
  const subscriptionActive = ref(false)
  const resolvedMode = ref<'builtin' | 'custom' | 'unconfigured'>('unconfigured')
  const mode = computed(() => resolvedMode.value)
  const loaded = ref(false)
  const error = ref('')
  const checkingAccess = ref(true)
  let accessCheckCount = 1
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  let pendingKey: { endpoint?: string; value: string } | undefined
  let saves = Promise.resolve()
  let saveError: Error | undefined
  let revision = 0

  onScopeDispose(() => {
    if (saveTimer) clearTimeout(saveTimer)
    pendingKey = undefined
  })

  async function refreshStatus() {
    const token = revision
    accessCheckCount += 1
    checkingAccess.value = true
    providerConfigured.value = false
    subscriptionActive.value = false
    try {
      const settings = await service.getProviderSettings()
      const active = settings.mode === 'builtin' && settings.configured
        ? hasActiveXmclSubscription(await xmclAccountService.getTogetherOverview())
        : false
      if (token === revision && settings.endpoint.trim() === endpoint.value.trim()
        && settings.model.trim() === model.value.trim()) {
        providerConfigured.value = settings.configured
        resolvedMode.value = settings.mode
        subscriptionActive.value = active
      }
    } finally {
      accessCheckCount -= 1
      checkingAccess.value = accessCheckCount > 0
    }
  }

  const ready = (async () => {
    try {
      const settings = await service.getProviderSettings()
      endpoint.value = settings.endpoint
      model.value = settings.model
      providerConfigured.value = settings.configured
      resolvedMode.value = settings.mode
      if (settings.mode === 'builtin' && settings.configured) {
        try {
          subscriptionActive.value = hasActiveXmclSubscription(
            await xmclAccountService.getTogetherOverview(),
          )
        } catch (cause) {
          error.value = cause instanceof Error ? cause.message : String(cause)
        }
      }
      loaded.value = true
    } finally {
      accessCheckCount -= 1
      checkingAccess.value = accessCheckCount > 0
    }
  })()

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = undefined
      void saveProviderSettings().catch(() => {})
    }, 500)
  }

  function saveProviderSettings() {
    // Capture all fields before joining the queue, never after an IPC await.
    const target = endpoint.value.trim()
    const targetModel = model.value
    const key = pendingKey
    const token = revision
    if (key && key.endpoint === undefined && target) {
      try {
        const url = new URL(target)
        if (['http:', 'https:'].includes(url.protocol)) key.endpoint = target
      } catch { /* Keep the key unbound while the URL is incomplete. */ }
    }
    const operation = saves.then(async () => {
      try {
        if (key?.value.trim() && !target) throw new Error('Enter an Agent URL before saving an API key.')
        await service.setProviderSettings({
          endpoint: target,
          model: targetModel,
          ...(key ? { apiKey: key.value } : {}),
        })
        if (pendingKey === key) pendingKey = undefined
        if (token === revision) {
          await refreshStatus()
          if (token === revision) {
            saveError = undefined
            error.value = ''
          }
        }
      } catch (cause) {
        if (token === revision) {
          saveError = cause instanceof Error ? cause : new Error(String(cause))
          error.value = saveError.message
        }
        throw cause
      }
    })
    // A failed write must not poison subsequent edits/retries.
    saves = operation.catch(() => {})
    return operation
  }

  watch(endpoint, (value, previous) => {
    if (!loaded.value || value.trim() === previous.trim()) return
    revision += 1
    // An unbound key typed before the URL remains a draft until a valid save.
    // Every other URL change clears the input, including custom host A -> B.
    if (pendingKey?.endpoint !== undefined || !pendingKey) {
      pendingKey = undefined
      apiKey.value = ''
    }
    providerConfigured.value = false
    scheduleSave()
  }, { flush: 'sync' })

  watch(model, () => {
    if (!loaded.value) return
    revision += 1
    scheduleSave()
  }, { flush: 'sync' })

  async function flush() {
    if (!loaded.value) await ready
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = undefined
    await saveProviderSettings()
    await saves
    if (saveError) throw saveError
  }

  function updateApiKey(value: string) {
    apiKey.value = value
    pendingKey = { endpoint: endpoint.value.trim() || undefined, value }
    revision += 1
    scheduleSave()
  }

  async function setApiKey(value: string) {
    updateApiKey(value)
    await flush()
  }

  async function clearApiKey() {
    await setApiKey('')
  }

  const resolvedEndpoint = computed(() => endpoint.value.trim() || BUILTIN_AGENT_ENDPOINT)
  const resolvedModel = computed(() => model.value.trim() || BUILTIN_AGENT_MODEL)
  const configured = computed(() => {
    if (checkingAccess.value) return false
    if (mode.value !== 'builtin') return providerConfigured.value
    return providerConfigured.value && subscriptionActive.value
  })

  return {
    apiKey,
    endpoint,
    model,
    configured,
    mode,
    loaded,
    error,
    ready,
    refreshStatus,
    flush,
    setApiKey,
    updateApiKey,
    clearApiKey,
    resolvedEndpoint,
    resolvedModel,
  }
}

export const useAgentSettings = createSharedComposable(() => createAgentSettings(
  useService(AgentServiceKey),
  useService(XmclAccountServiceKey),
))
