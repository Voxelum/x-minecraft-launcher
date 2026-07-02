import { ref, watch, onScopeDispose, computed } from 'vue'
import { useService } from '@/composables'
import { BaseServiceKey, AUTHORITY_MICROSOFT, LaunchServiceKey } from '@xmcl/runtime-api'
import { kUserContext } from '@/composables/user'
import { kMinecraftFriends } from '@/composables/minecraftFriends'
import { injection } from '@/util/inject'

export interface FriendPresenceInfo {
  profileId: string
  name: string
  avatar: string
  status: 'offline' | 'online' | 'playing'
  instanceName?: string
  version?: string
  serverAddress?: string
  p2pGroupId?: string
  lastActive: number
}

export function useFriendsPresence() {
  const { getSessionId } = useService(BaseServiceKey)
  const { userProfile, gameProfile } = injection(kUserContext)
  const { data: friendsData } = injection(kMinecraftFriends)
  const { on: onLaunchEvent } = useService(LaunchServiceKey)

  const clientToken = ref('')
  const onlineFriends = ref<Record<string, FriendPresenceInfo>>({})
  const enabled = ref(true)

  const isPlaying = ref(localStorage.getItem('peerIsPlaying') === 'true')
  const playingInstanceName = ref(localStorage.getItem('peerPlayingInstanceName') || '')
  const playingVersion = ref(localStorage.getItem('peerPlayingVersion') || '')
  const playingServer = ref(localStorage.getItem('peerPlayingServer') || '')

  onLaunchEvent('minecraft-start', (event: any) => {
    isPlaying.value = true
    playingInstanceName.value = event.name || ''
    playingVersion.value = event.version || ''
    playingServer.value = event.server ? `${event.server.host}:${event.server.port ?? 25565}` : ''
    
    localStorage.setItem('peerIsPlaying', 'true')
    localStorage.setItem('peerPlayingInstanceName', playingInstanceName.value)
    localStorage.setItem('peerPlayingVersion', playingVersion.value)
    localStorage.setItem('peerPlayingServer', playingServer.value)
    
    setupMyPresenceSocket()
  })

  onLaunchEvent('minecraft-exit', () => {
    isPlaying.value = false
    playingInstanceName.value = ''
    playingVersion.value = ''
    playingServer.value = ''
    
    localStorage.setItem('peerIsPlaying', 'false')
    localStorage.removeItem('peerPlayingInstanceName')
    localStorage.removeItem('peerPlayingVersion')
    localStorage.removeItem('peerPlayingServer')
    
    setupMyPresenceSocket()
  })

  // WebSockets references
  let myPresenceSocket: WebSocket | null = null
  const friendSockets = new Map<string, WebSocket>()
  let heartbeatInterval: any = null

  // Helper to convert UUID to Uint8Array for binary heartbeats
  function convertUUIDToUint8Array(id: string) {
    const cleaned = id.replace(/-/g, '')
    const matches = cleaned.match(/.{2}/g)
    if (!matches) return new Uint8Array(16)
    const ints = matches.map((v) => parseInt(v, 16))
    return new Uint8Array(ints)
  }

  // Get friends list
  const friendsList = computed(() => friendsData.value?.friends ?? [])

  // Check if active user is Microsoft user
  const isMicrosoftUser = computed(() => userProfile.value?.authority === AUTHORITY_MICROSOFT)

  // Initialize client token
  getSessionId().then((id) => {
    clientToken.value = id
  })

  // Start binary heartbeats for a socket
  function startHeartbeats(socket: WebSocket, id: string) {
    const idBinary = convertUUIDToUint8Array(id)
    const heartbeatMessage = new Uint8Array(16 + 8)
    heartbeatMessage.set(idBinary)
    const heartbeatView = new DataView(heartbeatMessage.buffer)

    heartbeatView.setFloat64(16, Date.now())
    if (socket.readyState === socket.OPEN) {
      socket.send(heartbeatMessage)
    }
  }

  // Build the presence profile containing current game activity
  function getMyPresenceProfile() {
    const profile = gameProfile.value
    
    // Check if we are hosting P2P
    const p2pGroupId = localStorage.getItem('peerGroup') || undefined

    return {
      id: profile.id,
      name: profile.name,
      textures: profile.textures,
      avatar: profile.textures?.SKIN?.url ?? '',
      status: isPlaying.value ? 'playing' : 'online',
      instanceName: playingInstanceName.value || undefined,
      version: playingVersion.value || undefined,
      serverAddress: playingServer.value || undefined,
      p2pGroupId,
    }
  }

  // Setup presence server socket for ourselves
  function setupMyPresenceSocket() {
    if (myPresenceSocket) {
      myPresenceSocket.close()
      myPresenceSocket = null
    }

    const myUUID = gameProfile.value?.id
    if (!myUUID || !clientToken.value || !enabled.value || !isMicrosoftUser.value) return

    const url = `wss://api.xmcl.app/group/presence-${myUUID}?client=${clientToken.value}`
    const ws = new WebSocket(url)
    myPresenceSocket = ws

    ws.onmessage = async (event) => {
      const { data } = event
      if (typeof data === 'string') {
        try {
          const payload = JSON.parse(data)
          if (payload.type === 'WHO' && payload.sender) {
            // A friend is asking who we are. Send our presence profile
            const profile = getMyPresenceProfile()
            ws.send(JSON.stringify({
              type: 'ME',
              receiver: payload.sender,
              sender: clientToken.value,
              profile,
            }))
          } else if (payload.type === 'ME' && payload.profile) {
            // We received a profile from someone in our room.
            // Check if they are actually our friend
            const isFriend = friendsList.value.some((f) => f.profileId.replace(/-/g, '').toLowerCase() === payload.profile.id.replace(/-/g, '').toLowerCase())
            if (isFriend) {
              // Update their presence status
              onlineFriends.value[payload.profile.id] = {
                profileId: payload.profile.id,
                name: payload.profile.name,
                avatar: payload.profile.avatar,
                status: payload.profile.status || 'online',
                instanceName: payload.profile.instanceName,
                version: payload.profile.version,
                serverAddress: payload.profile.serverAddress,
                p2pGroupId: payload.profile.p2pGroupId,
                lastActive: Date.now(),
              }
            }
          }
        } catch (e) {
          console.error('Error handling my presence message', e)
        }
      }
    }
  }

  // Setup friend monitor sockets
  function updateFriendSockets() {
    if (!clientToken.value || !enabled.value || !isMicrosoftUser.value) {
      clearAllSockets()
      return
    }

    const currentFriends = friendsList.value
    const currentFriendIds = new Set(currentFriends.map((f) => f.profileId))

    // Close sockets for removed friends
    for (const [friendId, ws] of friendSockets.entries()) {
      if (!currentFriendIds.has(friendId)) {
        ws.close()
        friendSockets.delete(friendId)
        delete onlineFriends.value[friendId]
      }
    }

    // Open sockets for new friends
    for (const friend of currentFriends) {
      const friendId = friend.profileId
      if (!friendSockets.has(friendId)) {
        const url = `wss://api.xmcl.app/group/presence-${friendId}?client=${clientToken.value}`
        const ws = new WebSocket(url)
        friendSockets.set(friendId, ws)

        ws.onopen = () => {
          // Send WHO to ask for their identity/presence
          ws.send(JSON.stringify({
            type: 'WHO',
            sender: clientToken.value,
          }))
        }

        ws.onmessage = (event) => {
          const { data } = event
          if (typeof data === 'string') {
            try {
              const payload = JSON.parse(data)
              if (payload.type === 'WHO') {
                // Respond to WHO requests
                const profile = getMyPresenceProfile()
                ws.send(JSON.stringify({
                  type: 'ME',
                  sender: clientToken.value,
                  profile,
                }))
              } else if (payload.type === 'ME' && payload.profile) {
                // Verify that they match the friend ID of this socket
                const normalizedProfileId = payload.profile.id.replace(/-/g, '').toLowerCase()
                const normalizedFriendId = friendId.replace(/-/g, '').toLowerCase()
                if (normalizedProfileId === normalizedFriendId) {
                  onlineFriends.value[friendId] = {
                    profileId: friendId,
                    name: payload.profile.name,
                    avatar: payload.profile.avatar,
                    status: payload.profile.status || 'online',
                    instanceName: payload.profile.instanceName,
                    version: payload.profile.version,
                    serverAddress: payload.profile.serverAddress,
                    p2pGroupId: payload.profile.p2pGroupId,
                    lastActive: Date.now(),
                  }
                }
              }
            } catch (e) {
              console.error('Error handling friend presence message', e)
            }
          }
        }
      }
    }
  }

  function clearAllSockets() {
    if (myPresenceSocket) {
      myPresenceSocket.close()
      myPresenceSocket = null
    }
    for (const ws of friendSockets.values()) {
      ws.close()
    }
    friendSockets.clear()
    onlineFriends.value = {}
  }

  // Periodic heartbeats and offline cleanup
  heartbeatInterval = setInterval(() => {
    const now = Date.now()

    // Send heartbeats
    if (myPresenceSocket && myPresenceSocket.readyState === WebSocket.OPEN && gameProfile.value?.id) {
      startHeartbeats(myPresenceSocket, gameProfile.value.id)
    }
    for (const [friendId, ws] of friendSockets.entries()) {
      if (ws.readyState === WebSocket.OPEN && gameProfile.value?.id) {
        startHeartbeats(ws, gameProfile.value.id)
      }
    }

    // Clean up offline friends (no activity/heartbeat for 15s)
    for (const [friendId, info] of Object.entries(onlineFriends.value)) {
      if (now - info.lastActive > 15_000) {
        delete onlineFriends.value[friendId]
      }
    }
  }, 4_000)

  // Watchers to trigger setup
  watch([clientToken, enabled, isMicrosoftUser, () => gameProfile.value?.id], () => {
    setupMyPresenceSocket()
    updateFriendSockets()
  })

  watch(friendsList, () => {
    updateFriendSockets()
  })

  // Cleanup on destroy
  onScopeDispose(() => {
    clearInterval(heartbeatInterval)
    clearAllSockets()
  })

  return {
    onlineFriends,
    enabled,
    friendsList,
    isMicrosoftUser,
  }
}
