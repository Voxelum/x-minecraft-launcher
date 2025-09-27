import { PeerState, SetRemoteDescriptionOptions, SharedState } from '@xmcl/runtime-api'
import { randomUUID } from 'crypto'
import EventEmitter from 'events'
import debounce from 'lodash.debounce'
import { promisify } from 'util'
import { brotliCompress, brotliDecompressSync } from 'zlib'
import { isNonnull } from '~/util/object'
import { createIceServersProvider, getKey } from './IceServers'
import { createLanDiscover } from './LanDiscover'
import { createPeerConnectionFactory } from './PeerConnectionFactory'
import { PeerContext, RTCPeerConnectionData } from './PeerContext'
import { createPeerGroup } from './PeerGorup'
import { createHosting } from './PeerHost'
import { PeerSession } from './PeerSession'
import { createPeerSharing } from './PeerSharing'
import { createPeerUserInfo } from './PeerUserInfo'
import { Peers } from './Peers'
import { createNat } from './nat'

const pBrotliCompress = promisify(brotliCompress)

async function decode<T>(description: string): Promise<T> {
  const v = brotliDecompressSync(Buffer.from(description, 'base64'))
  const s = v.toString('utf-8')
  return JSON.parse(s)
}
async function encode<T>(description: T): Promise<string> {
  return (await pBrotliCompress(JSON.stringify(description))).toString('base64')
}

export interface InitiateOptions {
  /**
   * Peer client id
   */
  remoteId?: string
  /**
   * Peer connection id
   */
  session?: string
  /**
   * The extra iceservers
   */
  iceServers?: RTCIceServer[]
  /**
   * Is you are master in this relationship
   */
  master?: boolean
}

interface DescriptorPayload {
  id: string
  session: string
  connections: Array<RTCPeerConnectionData>
}

export function createMultiplayer() {
  const state = Promise.withResolvers<SharedState<PeerState>>()
  const emitter = new EventEmitter()

  const peers = new Peers((id) => {
    state.promise.then(s => s.connectionDrop(id))
  })

  const idSignal = Promise.withResolvers<string>()
  const factory = createPeerConnectionFactory()

  // discover
  const discover = createLanDiscover(idSignal, peers, emitter)
  state.promise.then((s) => {
    s.subscribe('exposedPortsSet', (ports) => {
      discover.setExposedPorts(ports.map(p => p[0]))
    })
    discover.setExposedPorts(s.exposedPorts.map(p => p[0]))
  })

  const sharing = createPeerSharing(peers)
  const userInfo = createPeerUserInfo()
  const host = createHosting(peers)
  const group = createPeerGroup(idSignal, peers, userInfo.getUserInfo, initiate, async (peerId, payload) => {
    const result = await decode<DescriptorPayload>(payload)
    onRemoteDescription({
      id: peerId,
      session: result.session,
      connections: result.connections,
    }, false)
  }, (gstate) => {
    state.promise.then(s => s.groupStateSet(gstate))
  }, (e) => {
    state.promise.then(s => {
      if (e instanceof Error) {
        s.groupErrorSet({
          message: e.message,
          name: e.name,
          stack: e.stack,
        })
      }
      console.warn(e)
    })
  }, (id) => {
    state.promise.then(s => s.groupSet({ group: id, state: 'connected' }))
  }, () => {
    state.promise.then(s => s.groupSet({ group: '', state: 'closed' }))
  }, (sender, profile) => {
    state.promise.then(s => {
      const target = peers.get(sender)
      if (target) {
        s.connectionUserInfo({ id: target.id, info: profile })
      }
    })
  }, (ping, timestamp) => {
    state.promise.then(s => s.pingSet({ ping, timestamp }))
  })

  const iceServers = createIceServersProvider(
    factory,
    (server, ping) => {
      console.log('Valid ice server', server)
      state.promise.then(s => s.validIceServerSet(Array.from(new Set([...s.validIceServers, getKey(server)]))))
      if (ping) {
        const rawKey = getKey(server)
        const key = rawKey.split(':')[1] || rawKey
        state.promise.then(s => s.iceServerPingSet({ server: key, ping }))
      }
      debouncedRefreshNat()
    },
    (ip) => {
      console.log('Public ip', ip)
      state.promise.then(s => s.ipsSet(Array.from(new Set([...s.ips, ip]))))
    },
    (meta) => {
      state.promise.then(s => s.turnserversSet(meta))
    },
  )

  const nat = createNat(state.promise, iceServers)

  const portCandidate_0 = 35565
  const portCandidate_1 = 35566
  const portCandidate_2 = 35567
  const portCandidate_3 = 35568

  const init = (appDataPath: string, resourcePath: string, sessionId: string) => {
    factory.init(appDataPath)
    iceServers.init(appDataPath)
    idSignal.resolve(sessionId)
    sharing.setResourcePath(resourcePath)
  }

  const createContext = (remoteId: string | undefined, master: boolean, preferredIceServers: Array<RTCIceServer>): PeerContext => {
    const isAllowTurn = () => localStorage.getItem('peerAllowTurn') === 'true'
    let pivot = 0
    let turnPivot = 0
    return {
      isMaster: () => master,
      getIceServerCandidates: () => {
        const [stunservers, turnservers] = iceServers.get(preferredIceServers)
        // divide stunservers into 4 array
        const result: RTCIceServer[][] = [[], []]
        for (const s of stunservers) {
          if (result[pivot % result.length].length > 0) {
            break
          }
          result[pivot % result.length].push(s)
          pivot++
        }
        for (const s of turnservers) {
          if (result[turnPivot % result.length].length > 1) {
            break
          }
          result[turnPivot % result.length].push(s)
          turnPivot++
        }
        const filtered = result.filter(r => r.length > 0)
        console.log('Ice servers', filtered)
        return filtered
      },
      createConnection: factory.createConnection,
      getPeer: (peerId) => peers.get(peerId),
      onHeartbeat: (session, ping) => {
        state.promise.then(s => s.connectionPing({ id: session, ping }))
      },
      onInstanceShared: (session, manifest) => {
        state.promise.then(s => s.connectionShareManifest({ id: session, manifest }))
      },
      onDescriptorUpdate: async (session, connections) => {
        console.log(connections)

        const payload = { id: await idSignal.promise, session, connections } as DescriptorPayload

        encode(payload).then((compressed) => {
          state.promise.then(s => s.connectionLocalDescription({ id: payload.session, description: compressed }))
          if (remoteId) {
            console.log(`Send local description ${remoteId} (${session})`)
            group.getGroup()?.sendLocalDescriptionV2(remoteId, compressed, () => {
              const sess = peers.get(session)
              // not retry if the connection is established
              if (sess && sess.isDataChannelEstablished()) return false
              return true
            }).then((v) => {
              if (!v) return
              // remove this peer
              const sess = peers.get(session)
              if (sess) {
                if (!sess.isDataChannelEstablished()) {
                  peers.get(session)?.close()
                  peers.remove(session)
                  state.promise.then(s => s.connectionDrop(session))
                }
              }
            })
          }
        })
      },
      onIdentity: (session, info) => {
        const p = peers.get(session)
        if (p) {
          p.remoteInfo = info
        }
        state.promise.then(s => s.connectionUserInfo({ id: session, info }))
      },
      onConnectionEstablished: (sess, conn) => {
        state.promise.then(s => s.connectionStateChange({ id: sess, connectionState: 'connected' }))
        conn.addEventListener('connectionstatechange', () => {
          state.promise.then(s => s.connectionStateChange({ id: sess, connectionState: conn.connectionState }))
        })
      },
      onLanMessage: discover.onLanMessage,
      getUserInfo: userInfo.getUserInfo,
      getSharedInstance: sharing.getSharedInstance,
      getShadedInstancePath: sharing.getShadedInstancePath,
      getSharedAssetsPath: sharing.getSharedAssetsPath,
      getSharedLibrariesPath: sharing.getSharedLibrariesPath,
      getSharedImagePath: sharing.getSharedImagePath,
    }
  }

  function initiate(options: InitiateOptions) {
    const remoteId = options.remoteId
    const sessionId = options.session || randomUUID()
    const iceServers = options.iceServers || []
    const master = options.master ?? false

    console.log(`Create peer connection to [${remoteId}].`)

    if (remoteId) {
      group.getGroup()?.sendWho(remoteId)
    }

    state.promise.then(s => s.connectionAdd({
      id: sessionId,
      remoteId: remoteId ?? '',
      userInfo: {
        name: '',
        id: '',
        textures: {
          SKIN: { url: '' },
        },
        avatar: '',
      },
      pendingConnections: [],
      ping: -1,
      localDescriptionSDP: '',
      connectionState: 'new',
      sharing: undefined,
      selectedCandidate: undefined,
    }))

    const ctx = createContext(remoteId, master, iceServers)
    const sess = new PeerSession(sessionId, ctx)

    peers.add(sess)
    if (remoteId) {
      sess.peerId = remoteId
    }

    return sess
  }

  function onRemoteDescription({ session, id: sender, connections }: DescriptorPayload, manual: boolean) {
    let sess = peers.get(session, sender)

    if (!sess) {
      console.log(`Not found the ${sender}. Initiate new connection`)
      // Try to connect to the sender
      const iceServers = connections.map(v => v.turnserver).filter(isNonnull)
      sess = initiate({ remoteId: sender, session, iceServers, master: manual ? false : true })
    }

    try {
      sess.setRemoteDescription(connections)
    } catch (e) {
      if (e instanceof Error && e.name === 'Error') {
        e.name = 'SetRemoteDescriptionError'
      }
      throw e
    }

    return sess.id
  }

  function drop(id: string) {
    const existed = peers.get(id)
    if (existed) {
      existed.close()
      state.promise.then(s => s.connectionDrop(id))
      peers.remove(id)
    }
  }

  const debouncedRefreshNat = debounce(nat.refreshNat, 1000)

  nat.refreshNat()

  return {
    init,
    emitter,
    host,
    userInfo,
    peers,
    iceServers,
    sharing,
    nat,
    group,
    setState: (_state: SharedState<PeerState>) => {
      state.resolve(_state)
      _state.connectionClear()
    },
    initiate: async () => {
      const s = initiate({ master: true })
      return s.id
    },
    async setRemoteDescription({ description, type }: SetRemoteDescriptionOptions) {
      const desc: DescriptorPayload = await decode(description)
      return onRemoteDescription(desc, true)
    },
    drop,
  }
}
