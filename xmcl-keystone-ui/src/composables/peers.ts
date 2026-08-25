import { useIntervalFn } from '@vueuse/core'
import { GameProfileAndTexture, InstanceManifestServiceKey, LaunchServiceKey, Multiplayer, PeerServiceKey, PeerState, SharedState } from '@xmcl/runtime-api'
import { InjectionKey, onScopeDispose, Ref } from 'vue'
import { resolveLanSharingInstance } from '@/util/multiplayerTogether'
import { useDialog } from './dialog'
import { AddInstanceDialogKey } from './instanceTemplates'
import { useNotifier } from './notifier'
import { useRefreshable } from './refreshable'
import { useService } from './service'
import { useState } from './syncableState'

export const kPeerShared: InjectionKey<ReturnType<typeof usePeerConnections>> = Symbol('PeerState')

type PeerStateRef = Ref<SharedState<PeerState> | undefined>

function usePeerStateRef() {
  const { getPeerState } = useService(PeerServiceKey)
  return useState(getPeerState, PeerState).state
}

export function usePeerConnections(sharedState?: PeerStateRef) {
  const state = sharedState ?? usePeerStateRef()
  const { notify } = useNotifier()
  const { t } = useI18n()
  const { show: showShareInstance } = useDialog('share-instance')
  const { show: showAddInstance } = useDialog(AddInstanceDialogKey)
  watch(state, (s, _, onCleanup) => {
    if (!s) return
    const onShareManifest = ({ id, manifest }: Parameters<PeerState['connectionShareManifest']>[0]) => {
      const info = s.connections.find((c) => c.id === id)
      const name = info?.userInfo.name || id.substring(0, 6)
      const show = () => {
        if (manifest) {
          notify({
            icon: info?.userInfo.avatar,
            title: t('multiplayer.sharingNotificationTitle'),
            body: t('multiplayer.sharingNotificationBody', { name }),
            operations: [
              {
                text: t('shared.download'),
                icon: 'download',
                handler() {
                  showShareInstance(manifest)
                },
              },
              {
                text: t('instances.add'),
                icon: 'add',
                color: 'primary',
                handler() {
                  showAddInstance({
                    format: 'manifest',
                    manifest,
                  })
                },
              },
            ],
          })
        }
      }
      if (!document.hasFocus()) {
        windowController.flashFrame()
        window.addEventListener(
          'focus',
          () => {
            show()
          },
          { once: true },
        )
      } else {
        show()
      }
    }
    s.subscribe('connectionShareManifest', onShareManifest)
    onCleanup(() => s.unsubscribe('connectionShareManifest', onShareManifest))
  })
  return {
    connections: computed(() => state.value?.connections ?? []),
  }
}

export const kPeerState: InjectionKey<ReturnType<typeof usePeerState>> = Symbol('PeerState')

export function usePeerState(
  gameProfile: Ref<GameProfileAndTexture>,
  multiplayer: Multiplayer,
  sharedState?: PeerStateRef,
  refreshNat: () => Promise<void> = async () => {},
  selectedInstancePath: Ref<string> = ref(''),
) {
  const { exposePort, unexposePort, shareInstance } = useService(PeerServiceKey)
  const { getGameProcesses } = useService(LaunchServiceKey)
  const { getInstanceManifest } = useService(InstanceManifestServiceKey)
  const { notify } = useNotifier()
  const { t } = useI18n()
  const {
    initiate,
    setRemoteDescription,
    drop,
    isReady,
    setUserInfo,
    leaveGroup,
    createGroup,
    joinGroup,
    transferGroupMaster,
    refreshIceServers,
  } = multiplayer

  const state = sharedState ?? usePeerStateRef()

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
  const exposedPorts = computed(() => state.value?.exposedPorts.map((v) => v[0]) ?? [])

  watch(
    gameProfile,
    (p) => {
      setUserInfo({
        ...p,
        name: p.name,
        avatar: p.textures.SKIN.url,
      })
    },
    { immediate: true },
  )

  const group = computed(() => state.value?.group)
  const groupRole = computed(() => state.value?.groupRole || '')
  const groupSelfPeerId = computed(() => state.value?.groupSelfPeerId || '')
  const groupMasterPeerId = computed(() => state.value?.groupMasterPeerId || '')
  const groupMembers = computed(() => state.value?.groupMembers || [])
  const groupRevision = computed(() => state.value?.groupRevision || 0)
  const groupStatus = computed(() => state.value?.groupStatus || '')
  const groupMaxPeers = computed(() => state.value?.groupMaxPeers || 0)
  const groupState = computed(() => state.value?.groupState || 'closed')
  const icePings = computed(() => state.value?.icsServersPings || {})
  const groupPing = computed(() => state.value?.ping || NaN)
  const groupLastTimestamp = computed(() => state.value?.timestamp || NaN)
  const error = computed(() => state.value?.groupError)
  const turnservers = computed(() => state.value?.turnservers || {})

  let autoSharing: Promise<void> | undefined
  let autoSharedInstancePath = ''
  let warnedRunningInstances = ''
  const autoShareLanInstance = async () => {
    const processes = await getGameProcesses()
    const instancePath = resolveLanSharingInstance(processes, selectedInstancePath.value)
    if (!instancePath) {
      const runningInstances = Array.from(new Set(
        processes
          .filter((process) => process.side === 'client')
          .map((process) => process.options.gameDirectory),
      )).sort()
      const signature = runningInstances.join('\0')
      if (runningInstances.length > 1 && signature !== warnedRunningInstances) {
        warnedRunningInstances = signature
        notify({
          level: 'warning',
          title: t('multiplayer.share'),
          body: t('multiplayer.autoShareAmbiguous'),
        })
      } else if (runningInstances.length <= 1) {
        warnedRunningInstances = ''
      }
      return
    }
    if (instancePath === autoSharedInstancePath) return
    const manifest = await getInstanceManifest({ path: instancePath })
    if (groupRole.value !== 'master') return
    const currentProcesses = await getGameProcesses()
    if (!currentProcesses.some((process) => process.side === 'client' && process.options.gameDirectory === instancePath)) return
    await shareInstance({ manifest, instancePath })
    autoSharedInstancePath = instancePath
    warnedRunningInstances = ''
  }
  const onLocalLan = () => {
    if (groupRole.value !== 'master' || autoSharing) return
    autoSharing = autoShareLanInstance()
      .catch((error) => console.warn('Failed to automatically share the LAN instance', error))
      .finally(() => { autoSharing = undefined })
  }
  multiplayer.on('local-lan', onLocalLan)
  onScopeDispose(() => multiplayer.removeListener('local-lan', onLocalLan))

  const otherExposedPorts = ref([] as Array<{
    port: number
    user: string
    session: string
    motd: string
    lastSeen: number
  }>)
  const onLan = (msg: { port: number; session: string; motd: string }) => {
    const server = {
      ...msg,
      user:
        connections.value.find((connection) => connection.id === msg.session)?.userInfo.name ||
        msg.session.substring(0, 6),
      lastSeen: Date.now(),
    }
    otherExposedPorts.value = [
      ...otherExposedPorts.value.filter(({ session }) => session !== msg.session),
      server,
    ]
  }
  multiplayer.on('lan', onLan)
  onScopeDispose(() => multiplayer.removeListener('lan', onLan))

  useIntervalFn(() => {
    const active = otherExposedPorts.value.filter(({ lastSeen }) => Date.now() - lastSeen < 10_000)
    if (active.length !== otherExposedPorts.value.length) otherExposedPorts.value = active
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
    groupRole,
    groupSelfPeerId,
    groupMasterPeerId,
    groupMembers,
    groupRevision,
    groupStatus,
    groupMaxPeers,
    icePings,
    groupPing,
    groupLastTimestamp,
    groupState,
    connections,
    drop,
    leaveGroup,
    createGroup,
    joinGroup,
    transferGroupMaster,
    refreshIceServers,
    error,
  }
}
