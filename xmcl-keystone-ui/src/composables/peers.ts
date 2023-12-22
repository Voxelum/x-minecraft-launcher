import { GameProfileAndTexture, PeerServiceKey, PeerState } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { PeerGroup } from './peerGroup'
import { useService } from './service'
import { useState } from './syncableState'

export const kPeerState: InjectionKey<ReturnType<typeof usePeerState>> = Symbol('PeerState')

export function usePeerState(gameProfile: Ref<GameProfileAndTexture>) {
  const { getPeerState, initiate, on, setRemoteDescription } = useService(PeerServiceKey)
  const { state } = useState(getPeerState, PeerState)
  const connections = computed(() => state.value?.connections || [])

  const group = ref('')
  const groupState = ref<'connecting' | 'connected' | 'closing' | 'closed'>('closed')
  const error = ref<Error | undefined>(undefined)
  let _group: PeerGroup | undefined
  const _id = crypto.randomUUID()

  on('connection-local-description', ({ description, type }) => {
    _group?.sendLocalDescription(description.id, description.sdp, type, description.candidates)
  })

  function joinGroup(groupId?: string) {
    if (!groupId) {
      const buf = new Uint16Array(1)
      window.crypto.getRandomValues(buf)
      groupId = gameProfile.value.name + '@' + buf[0]
    }
    _group = new PeerGroup(groupId, _id)

    _group.onheartbeat = (sender) => {
      console.log(`Get heartbeat from ${sender}`)
      const peer = connections.value.find(p => p.remoteId === sender)
      // Ask sender to connect to me :)
      if (!peer) {
        if (_id.localeCompare(sender) > 0) {
          console.log(`Not found the ${sender}. Initiate new connection`)
          // Only if my id is greater than other's id, we try to initiate the connection.
          // This will have a total order in the UUID random space

          // Try to connect to the sender
          initiate({ remoteId: sender, initiate: true, gameProfile: gameProfile.value })
        }
      }
    }
    _group.ondescriptor = async (sender, sdp, type, candidates) => {
      setRemoteDescription({
        description: {
          id: sender,
          session: '',
          sdp,
          candidates,
        },
        type: type as any,
        gameProfile: gameProfile.value,
      })
    }
    _group.onstate = (state) => {
      groupState.value = state
    }
    _group.onerror = (err) => {
      if (err instanceof Error) error.value = err
    }

    group.value = groupId
    groupState.value = _group.state
  }

  function leaveGroup() {
    _group?.quit()
    _group = undefined
    group.value = ''
    groupState.value = 'closed'
  }

  function _setRemoteDescription(type: 'offer' | 'answer', description: string) {
    return setRemoteDescription({
      description,
      type,
      gameProfile: gameProfile.value,
    })
  }

  function _initiate() {
    return initiate({ gameProfile: gameProfile.value, initiate: true })
  }

  return {
    id: _id,
    joinGroup,
    leaveGroup,
    setRemoteDescription: _setRemoteDescription,
    initiate: _initiate,
    group,
    groupState,
    connections,
  }
}
