import { PeerServiceKey, PeerState } from '@xmcl/runtime-api'
import { useService } from './service'
import { useState } from './syncableState'

import { InjectionKey } from 'vue'

export const kPeerState: InjectionKey<ReturnType<typeof usePeerState>> = Symbol('PeerState')

export function usePeerState() {
  const { getPeerState } = useService(PeerServiceKey)
  const { state } = useState(getPeerState, PeerState)
  const connections = computed(() => state.value?.connections || [])
  const group = computed(() => state.value?.group ?? '')
  const groupState = computed(() => state.value?.groupState ?? 'closed')

  return {
    connections,
    groupState,
    group,
  }
}
