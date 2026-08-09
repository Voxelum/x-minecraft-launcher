import type { AgentUiAction } from '@xmcl/runtime-api'
import { computed, shallowRef } from 'vue'

export type AgentConfirmation = Extract<AgentUiAction, { action: 'confirm' }>

interface PendingConfirmation {
  id: number
  request: AgentConfirmation
  resolve(value: boolean): void
  permissionScope?: string
  signal?: AbortSignal
  onAbort?: () => void
}

let nextId = 1
const active = shallowRef<PendingConfirmation>()
const queue: PendingConfirmation[] = []
const allowedScopes = new Set<string>()
const registeredScopes = new Set<string>()

function showNext() {
  if (!active.value) active.value = queue.shift()
}

function removeAbortListener(item: PendingConfirmation) {
  if (item.signal && item.onAbort) item.signal.removeEventListener('abort', item.onAbort)
}

function finish(item: PendingConfirmation, value: boolean) {
  removeAbortListener(item)
  item.resolve(value)
  if (active.value?.id === item.id) {
    active.value = undefined
  } else {
    const index = queue.findIndex(candidate => candidate.id === item.id)
    if (index >= 0) queue.splice(index, 1)
  }
  showNext()
}

export function requestAgentConfirmation(request: AgentConfirmation, signal?: AbortSignal, permissionScope?: string): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false)
  const resolvedScope = permissionScope ?? (registeredScopes.size === 1 ? registeredScopes.values().next().value : undefined)
  if (resolvedScope && allowedScopes.has(resolvedScope) && !request.destructive) return Promise.resolve(true)
  return new Promise<boolean>((resolve) => {
    const item: PendingConfirmation = {
      id: nextId++,
      request,
      resolve,
      permissionScope: resolvedScope,
      signal,
    }
    if (signal) {
      item.onAbort = () => finish(item, false)
      signal.addEventListener('abort', item.onAbort, { once: true })
    }
    queue.push(item)
    showNext()
  })
}

/**
 * Prompt the user for confirmation of a (usually destructive/mutating) agent tool
 * action and throw if they decline. Shared by the launcher/management/server tools.
 */
export async function confirmAgentAction(input: {
  title: string
  message: string
  details?: string[]
  presentations?: AgentConfirmation['presentations']
  confirmLabel?: string
  destructive?: boolean
  allowAll?: boolean
}, signal?: AbortSignal, permissionScope?: string) {
  const accepted = await requestAgentConfirmation({
    action: 'confirm',
    title: input.title,
    message: input.message,
    details: input.details,
    presentations: input.presentations,
    confirmLabel: input.confirmLabel,
    destructive: input.destructive,
    allowAll: input.allowAll,
  }, signal, permissionScope)
  if (!accepted) throw new Error('User declined the action')
}

export function clearAgentConfirmationScope(permissionScope: string) {
  allowedScopes.delete(permissionScope)
  registeredScopes.delete(permissionScope)
}

export function registerAgentConfirmationScope(permissionScope: string) {
  registeredScopes.add(permissionScope)
}

export function useAgentConfirmation() {
  return {
    request: computed(() => active.value?.request),
    shown: computed(() => !!active.value),
    accept: () => active.value && finish(active.value, true),
    allowAll: () => {
      const item = active.value
      if (!item) return
      if (item.permissionScope) allowedScopes.add(item.permissionScope)
      finish(item, true)
    },
    decline: () => active.value && finish(active.value, false),
  }
}
