import { protocolToMinecraft, ServerStatus } from '@xmcl/runtime-api'
import { computed, Ref } from 'vue'

export function useProtocolAcceptVersion(protocol: Ref<number>) {
  return computed(() => `[${protocolToMinecraft[protocol.value].join(', ')}]`)
}

export function useSeverStatusAcceptVersion(status: Ref<ServerStatus>) {
  return computed(() => `[${(protocolToMinecraft[status.value.version.protocol] ?? []).join(', ')}]`)
}
