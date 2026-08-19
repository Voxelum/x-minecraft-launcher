import {
  type ConnectionUserInfo,
  type Multiplayer,
  type MultiplayerTransport,
  PeerServiceKey,
  PeerState,
} from '@xmcl/runtime-api'
import { useService } from '@/composables/service'
import { useState } from '@/composables/syncableState'

export function useTogetherMultiplayer(transport: Ref<MultiplayerTransport>) {
  const service = useService(PeerServiceKey)
  const { state } = useState(service.getPeerState, PeerState)
  let latestUserInfo: ConnectionUserInfo | undefined
  let transition = Promise.resolve()

  const selectTransport = (target: MultiplayerTransport) => {
    const operation = transition.catch(() => {}).then(async () => {
      await service.setMultiplayerTransport(target)
      if (latestUserInfo) await service.multiplayerSetUserInfo(latestUserInfo)
    })
    transition = operation.then(() => {}, () => {})
    return operation
  }

  watch(transport, (target) => {
    void selectTransport(target).catch(() => {})
  }, { immediate: true })

  const multiplayer: Multiplayer = {
    isReady: () => state.value !== undefined,
    getPeers: () => state.value?.connections ?? [],
    refreshIceServers: () => service.multiplayerRefreshIceServers(),
    setUserInfo(info) {
      latestUserInfo = info
      void service.multiplayerSetUserInfo(info)
    },
    initiate: () => service.multiplayerInitiate(),
    setRemoteDescription: (options) => service.multiplayerSetRemoteDescription(options),
    drop: (id) => service.multiplayerDrop(id),
    createGroup: () => service.multiplayerCreateGroup(),
    joinGroup: (groupId) => service.multiplayerJoinGroup(groupId),
    transferGroupMaster: (peerId) => service.multiplayerTransferGroupMaster(peerId),
    leaveGroup: () => service.multiplayerLeaveGroup(),
    on(event, listener) {
      service.on(event, listener)
      return multiplayer
    },
    once(event, listener) {
      service.once(event, listener)
      return multiplayer
    },
    removeListener(event, listener) {
      service.removeListener(event, listener)
      return multiplayer
    },
  }

  const refreshNat = async () => {
    await multiplayer.refreshIceServers().catch((error) => {
      console.warn('Failed to refresh ICE servers before network diagnostics', error)
    })
    const current = state.value
    if (!current) return
    try {
      const result = await multiplayerNetworkDiagnostics.refresh(
        current.validIceServers.map((urls) => ({ urls })),
      )
      current.ipsSet(Array.from(new Set([...current.ips, ...result.ips])))
      current.natTypeSet(result.natType)
      if (result.device) current.natDeviceSet(result.device)
    } catch (error) {
      console.warn('Failed to refresh multiplayer network diagnostics', error)
    }
  }
  return { multiplayer, state, refreshNat }
}
