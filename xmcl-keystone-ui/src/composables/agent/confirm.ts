import type { AgentUiAction } from '@xmcl/runtime-api'
import { computed, shallowRef } from 'vue'

export type AgentConfirmation = Extract<AgentUiAction, { action: 'confirm' }>

interface PendingConfirmation {
  id: number
  request: AgentConfirmation
  resolve(value: boolean): void
  signal?: AbortSignal
  onAbort?: () => void
}

let nextId = 1
const active = shallowRef<PendingConfirmation>()
const queue: PendingConfirmation[] = []

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

export function requestAgentConfirmation(request: AgentConfirmation, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false)
  return new Promise<boolean>((resolve) => {
    const item: PendingConfirmation = {
      id: nextId++,
      request,
      resolve,
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

export function useAgentConfirmation() {
  return {
    request: computed(() => active.value?.request),
    shown: computed(() => !!active.value),
    accept: () => active.value && finish(active.value, true),
    decline: () => active.value && finish(active.value, false),
  }
}
