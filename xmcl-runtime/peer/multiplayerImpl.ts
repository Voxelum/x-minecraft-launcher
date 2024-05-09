import { PeerState, SetRemoteDescriptionOptions, TransferDescription, createPromiseSignal } from '@xmcl/runtime-api'
import { randomUUID } from 'crypto'
import EventEmitter from 'events'
import { promisify } from 'util'
import { brotliCompress, brotliDecompress } from 'zlib'
import { NodeDataChannelModule } from './NodeDataChannel'
import { PeerConnectionFactory } from './PeerConnectionFactory'
import { PeerContext } from './PeerContext'
import { createHosting } from './PeerHost'
import { PeerSession } from './connection'
import { createIceServersProvider, getKey } from './iceServers'
import { createLanDiscover } from './lanDiscover'
import { exposeLocalPort, parseCandidate } from './mapAndGetPortCanidate'
import { raceNatType } from './nat'
import { createPeerGroup } from './peerGorup'
import { createPeerSharing } from './peerSharing'
import { createPeerUserInfo } from './peerUserInfo'
import { getDeviceInfo, isSupported } from './ssdpClient'
import debounce from 'lodash.debounce'

const pBrotliDecompress = promisify(brotliDecompress)
const pBrotliCompress = promisify(brotliCompress)

async function decode(description: string): Promise<TransferDescription> {
  return JSON.parse((await pBrotliDecompress(Buffer.from(description, 'base64'))).toString('utf-8'))
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
   * Is the peer the initiator (create the offer)
   */
  initiate?: boolean
  /**
   * Use the ice server
   */
  preferredIceServers?: RTCIceServer[]
}

export class Peers {
  private peers: Record<string, PeerSession> = {}

  onremove: (id: string) => void = () => { }

  add(peer: PeerSession) {
    this.peers[peer.id] = peer
  }

  #validate(sess: PeerSession) {
    if (sess && (sess.isClosed || sess.connection.connectionState === 'closed' || sess.connection.connectionState === 'disconnected')) {
      delete this.peers[sess.id]
      this.onremove(sess.id)
      return undefined
    }
    return sess
  }

  get(id: string, remoteId?: string): PeerSession | undefined {
    const sess = this.peers[id] || Object.values(this.peers).find(p => p.remoteId === remoteId || id)

    return this.#validate(sess)
  }

  remove(id: string) {
    delete this.peers[id]
  }

  get entries() {
    return Object.values(this.peers).map(p => this.#validate(p)).filter(v => !!v) as PeerSession[]
  }
}

export function createMultiplayer() {
  const peers = new Peers()
  const state = createPromiseSignal<PeerState>()
  const emitter = new EventEmitter()

  const discover = createLanDiscover(peers)
  const sharing = createPeerSharing(peers)
  const userInfo = createPeerUserInfo()
  const host = createHosting(peers)
  const group = createPeerGroup(peers, userInfo.getUserInfo, initiate, setRemoteDescription, (gstate) => {
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
  })

  peers.onremove = (id) => {
    state.then(s => s.connectionDrop(id))
  }

  const facotry: PeerConnectionFactory = {
    createConnection: async (ice, privatePort) => {
      if (localStorage.getItem('peerKernel') === 'webrtc') {
        console.log('Use webrtc')
        return new RTCPeerConnection({
          iceServers: ice ? [ice] : [],
          iceCandidatePoolSize: 8,
        })
      }
      console.log('Use node data channel')
      try {
        const { PeerConnection } = await NodeDataChannelModule.getInstance()
        const { RTCPeerConnection } = await import('node-datachannel/polyfill')
        return new RTCPeerConnection({
          iceServers: ice ? [ice] : [],
          iceTransportPolicy: 'all',
          portRangeBegin: privatePort,
          portRangeEnd: privatePort,
          enableIceUdpMux: true,
          // @ts-ignore
        }, { PeerConnection })
      } catch {
        console.log('Use webrtc fallback')
        return new RTCPeerConnection({
          iceServers: ice ? [ice] : [],
          iceCandidatePoolSize: 8,
        })
      }
    },
  }

  const iceServers = createIceServersProvider(
    facotry,
    (server) => {
      console.log('Valid ice server', server)
      state.then(s => s.validIceServerSet(Array.from(new Set([...s.validIceServers, getKey(server)]))))
      debouncedRefreshNat()
    },
    (ip) => {
      console.log('Public ip', ip)
      state.then(s => s.ipsSet(Array.from(new Set([...s.ips, ip]))))
    },
  )
  const portCandidate = 35565

  const getContext = (remoteId: string | undefined, stuns: Array<RTCIceServer>): PeerContext => {
    let index = 0
    return {
      getCurrentIceServer: () => stuns[index],
      getNextIceServer: () => {
        const cur = stuns[index]
        index = (index + 1) % stuns.length
        return cur
      },
      onHeartbeat: (session, ping) => {
        state.then(s => s.connectionPing({ id: session, ping }))
      },
      onInstanceShared: (session, manifest) => {
        state.then(s => s.connectionShareManifest({ id: session, manifest }))
      },
      onDescriptorUpdate: async (session, sdp, type, candidates) => {
        console.log(candidates)

        const candidate = candidates.find(c => c.candidate.indexOf('typ srflx') !== -1)
        if (candidate) {
          const [ip, port] = parseCandidate(candidate.candidate)
          if (ip && port) {
            await exposeLocalPort(portCandidate, Number(port)).catch((e) => {
              if (e.name === 'Error') { e.name = 'MapNatError' }
              console.error(e)
            })
          }
        }
        const payload = { sdp, id: remoteId, session, candidates }

        if (remoteId) {
          console.log(`Send local description ${remoteId}: ${sdp} ${type}`)
          // Send to the group if the remoteId is set
          group.getGroup()?.sendLocalDescription(remoteId, sdp, type, candidates, stuns[index], stuns)
        }

        pBrotliCompress(JSON.stringify(payload)).then((s) => s.toString('base64')).then((compressed) => {
          state.then(s => s.connectionLocalDescription({ id: payload.session, description: compressed }))
        })
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
    discover.start(sessionId)
    group.setId(sessionId)
    sharing.setResourcePath(resourcePath)
  }

  async function initiate(options: InitiateOptions) {
    const initiator = !options.remoteId || options.initiate || false
    const remoteId = options.remoteId
    const sessionId = options.session || randomUUID()
    const preferredIceServers = options.preferredIceServers || []

    console.log(`Create peer connection to [${remoteId}]. Is initiator: ${initiator}`)
    const privatePort = portCandidate

    const [stuns, turns] = await iceServers.get(preferredIceServers)
    const create = async (ctx: PeerContext, sessionId: string) => {
      const ice = ctx.getNextIceServer()
      console.log('Use ice servers: %o', ice)

      if (ice) {
        state.then(s => s.connectionIceServersSet({ id: sessionId, iceServer: ice }))
      }

      const allowTurn = localStorage.getItem('peerAllowTurn') === 'true'
      const co = await facotry.createConnection(ice, privatePort, allowTurn ? turns[0] : undefined)

      co.onsignalingstatechange = () => {
        state.then(s => s.signalingStateChange({ id: sessionId, signalingState: co.signalingState }))
      }
      co.onicegatheringstatechange = () => {
        state.then(s => s.iceGatheringStateChange({ id: sessionId, iceGatheringState: co.iceGatheringState }))
      }
      co.onconnectionstatechange = () => {
        // const pair = co.getSelectedCandidatePair()
        // if (pair) {
        //   console.log('Select pair %o', pair)
        //   state?.connectionSelectedCandidate({
        //     id: sessionId,
        //     remote: pair.remote as any,
        //     local: pair.local as any,
        //   })
        // }
        state.then(s => s.connectionStateChange({ id: sessionId, connectionState: co.connectionState }))
        if (co.connectionState === 'closed' || co.connectionState === 'disconnected' || co.connectionState === 'failed') {
          if (sess.isClosed) {
            // Close by user manually
            peers.remove(sessionId)
            state.then(s => s.connectionDrop(sessionId))
          } else {
            if (initiator) {
              // unexpected close! reconnect
              create(ctx, sessionId).then((s) => {
                sess.setConnection(s)
                sess.initiate()
              })
            } else {
              peers.remove(sessionId)
              state.then(s => s.connectionDrop(sessionId))
            }
          }
        }
      }

      return co
    }

    if (remoteId) {
      group.getGroup()?.sendWho(remoteId)
    }

    state.then(s => s.connectionAdd({
      id: sessionId,
      initiator,
      remoteId: remoteId ?? '',
      userInfo: {
        name: '',
        id: '',
        textures: {
          SKIN: { url: '' },
        },
        avatar: '',
      },
      iceServer: { urls: [] },
      triedIceServers: [],
      preferredIceServers,
      ping: -1,
      signalingState: 'closed',
      localDescriptionSDP: '',
      iceGatheringState: 'new',
      connectionState: 'new',
      sharing: undefined,
      selectedCandidate: undefined,
    }))

    const ctx = getContext(remoteId, stuns)
    const sess = new PeerSession(sessionId, await create(ctx, sessionId), ctx)

    peers.add(sess)
    if (remoteId) {
      sess.remoteId = remoteId
    }

    if (initiator) {
      sess.initiate()
    }

    return sess
  }

  async function setRemoteDescription({ sdp, candidates, id: sender, session }: TransferDescription, type: 'offer' | 'answer', targetIceServer?: RTCIceServer, preferredIceServers?: RTCIceServer[]) {
    let sess = peers.get(session, sender)

    const newPeer = !sess
    if (!sess) {
      console.log(`Not found the ${sender}. Initiate new connection`)
      // Try to connect to the sender
      sess = await initiate({ remoteId: sender, session, initiate: false, preferredIceServers })
    }

    // const currentIceServer = sess.context.getCurrentIceServer()
    // if (targetIceServer && currentIceServer && isSameRTCServer(currentIceServer, targetIceServer)) {
    //   // ignore the message if the target ice server is not the current ice server
    //   // in this case, the message is out of date
    //   return sess.id
    // }

    console.log(`Set remote ${type} description: ${sdp}`)
    console.log(candidates)
    const sState = sess.connection.signalingState
    if (sState !== 'stable' || newPeer) {
      try {
        sess.setRemoteDescription({ sdp, type })
        for (const { candidate, mid } of candidates) {
          console.log(`Add remote candidate: ${candidate} ${mid}`)
          sess.connection.addIceCandidate({ candidate, sdpMid: mid })
        }
      } catch (e) {
        if (e instanceof Error && e.name === 'Error') {
          e.name = 'SetRemoteDescriptionError'
        }
        throw e
      }
    } else {
      console.log('Skip to set remote description as signal state is stable')
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
    setState: (_state: PeerState) => {
      state.resolve(_state)
      _state.connectionClear()
    },
    setUserInfo: userInfo.setUserInfo,
    getNatDeviceInfo: getDeviceInfo,
    isNatSupported: isSupported,
    getPeers,
    initiate: async () => {
      const s = await initiate({ initiate: true })
      return s.id
    },
    async setRemoteDescription({ description, type }: SetRemoteDescriptionOptions) {
      const desc = typeof description === 'string' ? await decode(description) : description
      return setRemoteDescription(desc, type)
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
