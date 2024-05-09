import { GameProfileAndTexture, NatDeviceInfo, NatType, PeerServiceKey, PeerState } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useService } from './service'
import { useState } from './syncableState'
import { useRefreshable } from './refreshable'

export const kPeerShared: InjectionKey<ReturnType<typeof usePeerConnections>> = Symbol('PeerState')

export function usePeerConnections() {
  const { getPeerState } = useService(PeerServiceKey)
  const { state } = useState(getPeerState, PeerState)
  return {
    connections: computed(() => state.value?.connections ?? []),
  }
}

export const kPeerState: InjectionKey<ReturnType<typeof usePeerState>> = Symbol('PeerState')

export function usePeerState(gameProfile: Ref<GameProfileAndTexture>) {
  const { getPeerState } = useService(PeerServiceKey)
  const { initiate, setRemoteDescription, drop, refreshNat, isReady, setUserInfo, leaveGroup, joinGroup } = multiplayer

  const { state } = useState(getPeerState, PeerState)

  const refreshNatType = useRefreshable(() => refreshNat())

  const device = computed(() => state.value?.natDeviceInfo)
  const natType = computed(() => {
    const type = state.value?.natType || 'Unknown'
    if (type === 'Blocked') {
      if (state.value && state.value.ips.length > 0) {
        return 'Symmetric NAT'
      }
      return 'Blocked'
    }
    return type
  })

  const connections = computed(() => state.value?.connections ?? [])
  const validIceServers = computed(() => state.value?.validIceServers ?? [])
  const ips = computed(() => state.value?.ips ?? [])

  watch(gameProfile, (p) => {
    setUserInfo({
      ...p,
      name: p.name,
      avatar: p.textures.SKIN.url,
    })
  }, { immediate: true })

  const group = computed(() => state.value?.group)
  const groupState = computed(() => state.value?.groupState || 'closed')
  const error = computed(() => state.value?.groupError)

  function _setRemoteDescription(type: 'offer' | 'answer', description: string) {
    return setRemoteDescription({
      description,
      type,
    })
  }

  return {
    device,
    validIceServers,
    natType,
    refreshNatType: refreshNatType.refresh,
    refreshingNatType: refreshNatType.refreshing,
    ips,
    setRemoteDescription: _setRemoteDescription,
    initiate,
    group,
    groupState,
    connections,
    drop,
    leaveGroup,
    joinGroup,
  }
}
