import { computed, inject, InjectionKey, provide, reactive, Ref, ref, set, watch } from 'vue'
import { useService } from './service'
import { PINGING_STATUS, ServerStatus, UNKNOWN_STATUS, InstanceServiceKey, ServerStatusServiceKey, protocolToMinecraft } from '@xmcl/runtime-api'

export function useProtocolAcceptVersion(protocol: Ref<number>) {
  return computed(() => `[${protocolToMinecraft[protocol.value].join(', ')}]`)
}

export function useSeverStatusAcceptVersion(status: Ref<ServerStatus>) {
  return computed(() => `[${(protocolToMinecraft[status.value.version.protocol] ?? []).join(', ')}]`)
}
