import { SharedState, PeerState, SetRemoteDescriptionOptions, TransferDescription, createPromiseSignal } from '@xmcl/runtime-api'
import { randomUUID } from 'crypto'
import EventEmitter from 'events'
import { promisify } from 'util'
import { brotliCompress, brotliDecompress } from 'zlib'
import { NodeDataChannelModule } from './NodeDataChannel'
import { PeerConnectionFactory } from './PeerConnectionFactory'
import { PeerContext, RTCPeerConnectionData } from './PeerContext'
import { createHosting } from './PeerHost'
import { PeerSession } from './PeerSession'
import { createIceServersProvider, getKey } from './iceServers'
import { createLanDiscover } from './lanDiscover'
import { exposeLocalPort, parseCandidate } from './mapAndGetPortCanidate'
import { raceNatType } from './nat'
import { createPeerGroup } from './PeerGorup'
import { createPeerSharing } from './peerSharing'
import { createPeerUserInfo } from './peerUserInfo'
import { getDeviceInfo, isSupported } from './ssdpClient'
import debounce from 'lodash.debounce'
import { isNonnull } from '~/util/object'
import { Peers } from './Peers'

const pBrotliDecompress = promisify(brotliDecompress)
const pBrotliCompress = promisify(brotliCompress)

async function decode<T>(description: string): Promise<T> {
  return JSON.parse((await pBrotliDecompress(Buffer.from(description, 'base64'))).toString('utf-8'))
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
}

interface DescriptorPayload {
  id: string
  session: string
  connections: Array<RTCPeerConnectionData>
}

export function createMultiplayer() {
  const peers = new Peers()
  const state = createPromiseSignal<SharedState<PeerState>>()
  const emitter = new EventEmitter()
  let _PeerConnection: any
  let _RTCPeerConnection: typeof RTCPeerConnection

  NodeDataChannelModule.getInstance().then(({ PeerConnection }) => {
    _PeerConnection = PeerConnection
  })
  import('node-datachannel/polyfill').then(({ RTCPeerConnection }) => {
    _RTCPeerConnection = RTCPeerConnection as any
  })

  const idSignal = createPromiseSignal<string>()

  const discover = createLanDiscover(idSignal, peers, emitter)
  const sharing = createPeerSharing(peers)
  const userInfo = createPeerUserInfo()
  const host = createHosting(peers)
  const group = createPeerGroup(idSignal, peers, userInfo.getUserInfo, initiate, async (peerId, payload) => {
    const result = await decode<DescriptorPayload>(payload)
    onRemoteDescription(result)
  }, (gstate) => {
    state.then(s => s.groupStateSet(gstate))
  }, (e) => {
    state.then(s => {
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
    state.then(s => s.groupSet({ group: id, state: 'connected' }))
  }, () => {
    state.then(s => s.groupSet({ group: '', state: 'closed' }))
  }, (sender, profile) => {
    state.then(s => {
      const target = peers.get(sender)
      if (target) {
        s.connectionUserInfo({ id: target.id, info: profile })
      }
    })
  }, (ping, timestamp) => {
    state.then(s => s.pingSet({ ping, timestamp }))
  })

  state.then((s) => {
    s.subscribe('exposedPortsSet', (ports) => {
      discover.setExposedPorts(ports.map(p => p[0]))
    })
    discover.setExposedPorts(s.exposedPorts.map(p => p[0]))
  })

  peers.onremove = (id) => {
    state.then(s => s.connectionDrop(id))
  }

  const facotry: PeerConnectionFactory = {
    createConnection: (servers, privatePort) => {
      if (localStorage.getItem('peerKernel') === 'webrtc') {
        console.log('Use webrtc', servers)
        return new RTCPeerConnection({
          iceServers: servers,
          iceCandidatePoolSize: 4,
        })
      }
      console.log('Use node data channel', servers)
      try {
        if (_RTCPeerConnection && _PeerConnection) {
          return new _RTCPeerConnection({
            iceServers: servers,
            iceTransportPolicy: 'all',
            iceCandidatePoolSize: 4,
            enableIceUdpMux: true,
            // @ts-ignore
          }, _PeerConnection)
        } else {
          return new RTCPeerConnection({
            iceServers: servers,
            iceCandidatePoolSize: 4,
          })
        }
      } catch (e) {
        console.debug(e)
        console.log('Use webrtc fallback', servers)
        return new RTCPeerConnection({
          iceServers: servers,
          iceCandidatePoolSize: 4,
        })
      }
    },
  }

  const iceServers = createIceServersProvider(
    facotry,
    (server, ping) => {
      console.log('Valid ice server', server)
      state.then(s => s.validIceServerSet(Array.from(new Set([...s.validIceServers, getKey(server)]))))
      if (ping) {
        const rawKey = getKey(server)
        const key = rawKey.split(':')[1] || rawKey
        state.then(s => s.iceServerPingSet({ server: key, ping }))
      }
      debouncedRefreshNat()
    },
    (ip) => {
      console.log('Public ip', ip)
      state.then(s => s.ipsSet(Array.from(new Set([...s.ips, ip]))))
    },
    (meta) => {
      state.then(s => s.turnserversSet(meta))
    },
  )
  const portCandidate_0 = 35565
  const portCandidate_1 = 35566
  const portCandidate_2 = 35567
  const portCandidate_3 = 35568

  const createContext = (remoteId: string | undefined, preferredIceServers: Array<RTCIceServer>): PeerContext => {
    const isAllowTurn = () => localStorage.getItem('peerAllowTurn') === 'true'
    let pivot = 0
    let turnPivot = 0
    return {
      getIceServerCandidates: () => {
        const [stunservers, turnservers] = iceServers.get(preferredIceServers)
        // divide stunservers into 4 array
        const result: RTCIceServer[][] = [[], [], [], []]
        for (const s of stunservers) {
          result[pivot % 4].push(s)
          pivot++
        }
        for (const s of turnservers) {
          result[turnPivot % 4].push(s)
          turnPivot++
        }
        return result
      },
      createConnection: facotry.createConnection,
      getPeer: (peerId) => peers.get(peerId),
      onHeartbeat: (session, ping) => {
        state.then(s => s.connectionPing({ id: session, ping }))
      },
      onInstanceShared: (session, manifest) => {
        state.then(s => s.connectionShareManifest({ id: session, manifest }))
      },
      onDescriptorUpdate: (session, connections) => {
        console.log(connections)

        const payload = { id: remoteId, session, connections }

        encode(payload).then((compressed) => {
          state.then(s => s.connectionLocalDescription({ id: payload.session, description: compressed }))
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
                  state.then(s => s.connectionDrop(session))
                }
              }
            })
          }
        })

        // const candidate = candidates.find(c => c.candidate.indexOf('typ srflx') !== -1)
        // if (candidate) {
        //   const [ip, port] = parseCandidate(candidate.candidate)
        //   if (ip && port) {
        //     exposeLocalPort(portCandidate_0, Number(port)).catch((e) => {
        //       if (e.name === 'Error') { e.name = 'MapNatError' }
        //       console.error(e)
        //     })
        //   }
        // }
      },
      onIdentity: (session, info) => {
        const p = peers.get(session)
        if (p) {
          p.remoteInfo = info
        }
        state.then(s => s.connectionUserInfo({ id: session, info }))
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

  const getPeers = () => peers

  const init = (appDataPath: string, resourcePath: string, sessionId: string) => {
    NodeDataChannelModule.init(appDataPath)
    iceServers.init(appDataPath)
    idSignal.resolve(sessionId)
    sharing.setResourcePath(resourcePath)
  }

  function initiate(options: InitiateOptions) {
    const remoteId = options.remoteId
    const sessionId = options.session || randomUUID()
    const iceServers = options.iceServers || []

    console.log(`Create peer connection to [${remoteId}].`)

    if (remoteId) {
      group.getGroup()?.sendWho(remoteId)
    }

    state.then(s => s.connectionAdd({
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
      ping: -1,
      localDescriptionSDP: '',
      iceGatheringState: 'new',
      connectionState: 'new',
      sharing: undefined,
      selectedCandidate: undefined,
    }))

    const ctx = createContext(remoteId, iceServers)
    const sess = new PeerSession(sessionId, ctx)

    peers.add(sess)
    if (remoteId) {
      sess.peerId = remoteId
    }

    return sess
  }

  function onRemoteDescription({ session, id: sender, connections }: DescriptorPayload) {
    let sess = peers.get(session, sender)

    if (!sess) {
      console.log(`Not found the ${sender}. Initiate new connection`)
      // Try to connect to the sender
      const iceServers = connections.map(v => v.turnserver).filter(isNonnull)
      sess = initiate({ remoteId: sender, session, iceServers })
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

  async function refreshNat() {
    const s = await state
    await Promise.all([
      s.natDeviceInfo
        ? Promise.resolve()
        : getDeviceInfo().then((i) => {
          if (i) { s.natDeviceSet(i) }
        }),
      raceNatType(s, (await iceServers.get())[0]),
    ])
  }

  const debouncedRefreshNat = debounce(refreshNat, 1000)

  refreshNat()

  return {
    init,
    emitter,
    host,
    updateIceServers: iceServers.update,
    setState: (_state: SharedState<PeerState>) => {
      state.resolve(_state)
      _state.connectionClear()
    },
    setUserInfo: userInfo.setUserInfo,
    getNatDeviceInfo: getDeviceInfo,
    isNatSupported: isSupported,
    getPeers,
    initiate: async () => {
      const s = initiate({})
      return s.id
    },
    async setRemoteDescription({ description, type }: SetRemoteDescriptionOptions) {
      const desc = typeof description === 'string' ? await decode(description) : description
      return onRemoteDescription(desc)
    },
    shareInstance: sharing.shareInstance,
    async drop(id: string): Promise<void> {
      const existed = peers.get(id)
      if (existed) {
        existed.close()
        state.then(s => s.connectionDrop(id))
      }
    },

    refreshNat,
    joinGroup: group.joinGroup,
    leaveGroup: group.leaveGroup,
  }
}
