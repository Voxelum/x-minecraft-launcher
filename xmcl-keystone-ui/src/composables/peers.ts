import { GameProfileAndTexture, NatDeviceInfo, NatType, PeerServiceKey, PeerState } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useService } from './service'
import { useState } from './syncableState'
import { useRefreshable } from './refreshable'
import { LocalNotification, useNotifier } from './notifier'
import { useDialog } from './dialog'
import { AddInstanceDialogKey } from './instanceTemplates'
import { useIntervalFn } from '@vueuse/core'

export const kPeerShared: InjectionKey<ReturnType<typeof usePeerConnections>> = Symbol('PeerState')

export function usePeerConnections(notification: Ref<LocalNotification[]>) {
  const { getPeerState } = useService(PeerServiceKey)
  const { state } = useState(getPeerState, PeerState)
  const { notify } = useNotifier(notification)
  const { t } = useI18n()
  const { show: showShareInstance } = useDialog('share-instance')
  const { show: showAddInstance } = useDialog(AddInstanceDialogKey)
  watch(state, (s) => {
    if (!s) return
    s.subscribe('connectionShareManifest', ({ id, manifest }) => {
      const info = s.connections.find(c => c.id === id)
      const name = info?.userInfo.name || id.substring(0, 6)
      const show = () => {
        if (manifest) {
          notify({
            icon: info?.userInfo.avatar,
            title: t('multiplayer.sharingNotificationTitle'),
            body: t('multiplayer.sharingNotificationBody', { name }),
            operations: [{
              text: t('download'),
              icon: 'download',
              handler() {
                showShareInstance(manifest)
              },
            }, {
              text: t('instances.add'),
              icon: 'add',
              color: 'primary',
              handler() {
                showAddInstance({
                  type: 'manifest',
                  manifest,
                })
              },
            }],
          })
        }
      }
      if (!document.hasFocus()) {
        windowController.flashFrame()
        window.addEventListener('focus', () => {
          show()
        }, { once: true })
      } else {
        show()
      }
    })
  })
  return {
    connections: computed(() => state.value?.connections ?? []),
  }
}

export const kPeerState: InjectionKey<ReturnType<typeof usePeerState>> = Symbol('PeerState')

export function usePeerState(gameProfile: Ref<GameProfileAndTexture>) {
  const { getPeerState, exposePort, unexposePort } = useService(PeerServiceKey)
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
  const exposedPorts = computed(() => state.value?.exposedPorts.map(v => v[0]) ?? [])

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
  const turnservers = computed(() => state.value?.turnservers || {})

  let buffer = [] as Array<{ port: number; session: string }>
  const otherExposedPorts = ref([] as Array<{ port: number; user: string }>)
  multiplayer.on('lan', (msg) => {
    buffer.push(msg)
  })

  useIntervalFn(() => {
    if (buffer.length > 0) {
      const b = buffer
      otherExposedPorts.value = b.map(({ port, session }) => {
        return {
          port,
          user: connections.value.find(c => c.id === session)?.userInfo.name || session.substring(0, 6),
        }
      })
      buffer = []
    } else if (otherExposedPorts.value.length > 0) {
      otherExposedPorts.value = []
    }
  }, 1000)

  function _setRemoteDescription(type: 'offer' | 'answer', description: string) {
    return setRemoteDescription({
      description,
      type,
    })
  }

  return {
    exposedPorts,
    exposePort,
    unexposePort,
    otherExposedPorts,
    device,
    turnservers,
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
