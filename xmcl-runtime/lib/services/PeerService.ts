import { MinecraftLanDiscover } from '@xmcl/client'
import { ChecksumNotMatchError } from '@xmcl/file-transfer'
import { AUTHORITY_MICROSOFT, InstanceManifest, PeerService as IPeerService, MutableState, PeerServiceKey, PeerState, ShareInstanceOptions, UpnpMapOptions, UserState } from '@xmcl/runtime-api'
import { AbortableTask, BaseTask } from '@xmcl/task'
import { randomFill, randomUUID } from 'crypto'
import { createWriteStream } from 'fs'
import { ensureFile } from 'fs-extra/esm'
import { IceServer, initLogger } from 'node-datachannel'
import { join } from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { request } from 'undici'
import { promisify } from 'util'
import { brotliCompress, brotliDecompress } from 'zlib'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { IS_DEV } from '../constant'
import { PeerGroup, TransferDescription } from '../entities/peer'
import { PeerSession } from '../entities/peer/connection'
import { MessageShareManifest } from '../entities/peer/messages/download'
import { MessageLan } from '../entities/peer/messages/lan'
import { kResourceWorker, ResourceWorker } from '../entities/resourceWorker'
import { ImageStorage } from '../util/imageStore'
import { Inject } from '../util/objectRegistry'
import { NatService } from './NatService'
import { ExposeServiceKey, Lock, Singleton, StatefulService } from './Service'
import { UserService } from './UserService'
import { kGameDataPath, PathResolver } from '../entities/gameDataPath'

const pBrotliDecompress = promisify(brotliDecompress)
const pBrotliCompress = promisify(brotliCompress)

@ExposeServiceKey(PeerServiceKey)
export class PeerService extends StatefulService<PeerState> implements IPeerService {
  readonly peers: Record<string, PeerSession> = {}

  readonly discover = new MinecraftLanDiscover()
  /**
   * The unique id of this host
   */
  readonly id = randomUUID()

  private sharedManifest: InstanceManifest | undefined
  private shareInstancePath = ''
  private iceServers: IceServer[] = []

  private group: PeerGroup | undefined

  private portCandidate = 35565

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ImageStorage) private imageStorage: ImageStorage,
    @Inject(kResourceWorker) private worker: ResourceWorker,
    @Inject(kGameDataPath) private getPath: PathResolver,
    @Inject(NatService) natService: NatService,
    @Inject(UserService) private userService: UserService,
  ) {
    super(app, () => new PeerState(), async () => {
      const initCredential = async () => {
        await this.fetchCredential()
        const state = await userService.getUserState()
        state.subscribe('userProfile', (profile) => {
          if (profile.authority === AUTHORITY_MICROSOFT && this.iceServers.length === 0) {
            this.fetchCredential()
          }
        })
      }
      const initNat = async () => {
        if (!await natService.isSupported()) return

        const mappings = await natService.getMappings()
        const existedMappings = mappings.filter(m => m.description.indexOf('XMCL Multiplayer') !== -1 && m.enabled)
        const findPorts = () => {
          let candidate = this.portCandidate
          while (candidate < 60000) {
            if (mappings.some(p => p.public.port === candidate ||
              p.public.port === candidate + 1 ||
              p.public.port === candidate + 2)) {
              // port is occupied
              candidate += 3
            } else {
              // candidate pass
              break
            }
          }
          return [[candidate, candidate], [candidate + 1, candidate + 1], [candidate + 2, candidate + 2]] as const
        }
        if (existedMappings.length > 0) {
          this.log('Reuse the existed upnp mapping %o', existedMappings)
          this.portCandidate = existedMappings[0].private.port
        } else {
          const ports = findPorts()
          const pendingMappings: UpnpMapOptions[] = []
          for (const [priv, pub] of ports) {
            pendingMappings.push({
              description: `XMCL Multiplayer - udp - ${priv} - ${pub}`,
              protocol: 'udp',
              private: priv,
              public: pub,
              ttl: 24 * 60 * 60,
            }, {
              description: `XMCL Multiplayer - tcp - ${priv} - ${pub}`,
              protocol: 'tcp',
              private: priv,
              public: pub,
              ttl: 24 * 60 * 60,
            })
          }
          this.log('Create new upnp mapping %o', pendingMappings)
          await Promise.all(pendingMappings.map(n => natService.unmap({
            protocol: n.protocol,
            public: n.public,
          })))
          await Promise.all(pendingMappings.map(n => natService.map(n)))
          this.portCandidate = ports[0][0]
        }
      }

      initCredential().catch(e => {
        this.warn('Fail to init credential', e)
      })
      initNat().catch((e) => {
        this.warn('Fail to init nat', e)
      })
    })

    if (IS_DEV) {
      const logger = this.app.getLogger('wrtc', 'wrtc')
      initLogger('Verbose', (level, message) => {
        if (level === 'Info' || level === 'Debug' || level === 'Verbose') {
          logger.log(message)
        } else if (level === 'Fatal' || level === 'Error') {
          logger.warn(message)
        } else if (level === 'Warning') {
          logger.warn(message)
        }
      })
    } else {
      const logger = this.app.getLogger('wrtc', 'wrtc')
      initLogger('Info', (level, message) => {
        if (level === 'Info' || level === 'Debug' || level === 'Verbose') {
          logger.log(message)
        } else if (level === 'Fatal' || level === 'Error') {
          logger.warn(message)
        } else if (level === 'Warning') {
          logger.warn(message)
        }
      })
    }

    app.protocol.registerHandler('peer', ({ request, response }) => {
      // handle peer protocol
      if (request.url.protocol === 'peer:') {
        const peer = this.peers[request.url.hostname]
        if (peer) {
          this.log(`Create read stream from peer protocol ${request.url} for peer ${peer}`)
          response.status = 200
          response.body = peer.createReadStream(request.url.pathname)
        } else {
          this.log(`Not found peer ${peer} from ${request.url}`)
          response.status = 404
        }
      }
    })
    app.protocol.registerHandler('xmcl', ({ request, response }) => {
      const parsed = request.url
      if (parsed.host === 'launcher' && parsed.pathname === '/peer') {
        const params = parsed.searchParams
        const group = params.get('group')

        if (!group) {
          this.warn(`Ignore illegal peer join for group=${group}`)
          response.status = 400
        } else {
          this.joinGroup(group)
          response.status = 200
        }
      }
    })

    this.discover.bind().then(() => {
      this.log('Minecraft LAN discover ready')
    }, (e) => {
      this.error(new Error('Fail to bind Minecraft LAN discover', { cause: e }))
    })

    this.discover.socket.on('error', (e) => {
      this.error(new Error('Minecraft discover socket error', { cause: e }))
    })

    this.discover.on('discover', (info) => {
      const peers = Object.values(this.peers).filter(c => c.connection.state() === 'connected')
      for (const conn of peers) {
        const pair = conn.connection.getSelectedCandidatePair()
        if (pair && pair.remote.type === 'host') {
          if (conn.getRemoteId().localeCompare(this.id) > 0) {
            // Same LAN, larger id will broadcast
            return
          }
        }

        const isFromSelf = conn.proxies.find(p =>
          // Port is created by yourself
          p.actualPortValue === info.port)
        if (isFromSelf) {
          // do not echo the proxy server you created
          return
        }
      }
      for (const conn of peers) {
        conn.send(MessageLan, info)
      }
    })
  }

  async getPeerState(): Promise<MutableState<PeerState>> {
    return this.state
  }

  async leaveGroup(): Promise<void> {
    this.group?.quit()
    this.group = undefined
    this.state.connectionGroup('')
    this.state.connectionGroupState('closed')
    this.emit('connection-group', '')
    this.emit('connection-group-state', 'closed')
  }

  @Singleton()
  async fetchCredential() {
    this.log('Try to fetch rtc credential')
    const officialAccount = await this.userService.getOfficialUserProfile()
    if (officialAccount) {
      this.log(`Use minecraft xbox ${officialAccount.username} to fetch rtc credential`)
      const response = await request('https://api.xmcl.app/rtc/official', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${officialAccount.accessToken}`,
        },
      })
      if (response.statusCode === 200) {
        const credential: {
          password: string
          username: string
          uris: string[]
        } = await response.body.json()
        this.iceServers.splice(0, this.iceServers.length)
        this.iceServers.push(...credential.uris
          .filter(u => u.startsWith('turn:'))
          .map(u => u.substring('turn:'.length))
          .map(u => {
            const [hostname, port] = u.split(':')
            return {
              username: credential.username,
              password: credential.password,
              hostname,
              port: port ? Number.parseInt(port) : 3478,
              relayType: 'TurnUdp' as any,
            }
          }))
        this.log(`Updated the rtc credential by xbox ${officialAccount.username}.`)
      } else if (response.statusCode === 401) {
        this.warn(`The xbox ${officialAccount.username} is not valid. Try to refresh the access token.`)
      } else {
        this.error(new Error(`Fail to fetch the rtc credential by xbox ${officialAccount.username}. Status ${response.statusCode}.`))
      }
    }
  }

  @Lock('joinGroup')
  async joinGroup(id: string): Promise<void> {
    if (this.group?.groupId && this.group.groupId === id) {
      return
    }

    if (this.group) {
      this.group.quit()
    }

    const group = new PeerGroup(id, this.id)

    group.on('heartbeat', (sender) => {
      const peer = Object.values(this.peers).find(p => p.getRemoteId() === sender)
      // Ask sender to connect to me :)
      if (!peer) {
        if (this.id.localeCompare(sender) > 0) {
          this.log(`Not found the ${sender}. Initiate new connection`)
          // Only if my id is greater than other's id, we try to initiate the connection.
          // This will have a total order in the UUID random space

          // Try to connect to the sender
          this.initiate({ id: sender, initiate: true })
        }
      }
    })
    group.on('descriptor', async (sender, sdp, type, candidates) => {
      let peer = Object.values(this.peers).find(p => p.getRemoteId() === sender)
      this.log(`Descriptor from ${sender}`)
      const newPeer = !peer
      if (!peer) {
        this.log(`Not found the ${sender}. Initiate new connection`)
        // Try to connect to the sender
        await this.initiate({ id: sender, initiate: false })
        peer = Object.values(this.peers).find(p => p.getRemoteId() === sender)!
      }
      this.log(`Set remote ${type} description: ${sdp}`)
      this.log(candidates)
      const state = peer.connection.signalingState()
      if (state !== 'stable' || newPeer) {
        peer.connection.setRemoteDescription(sdp, type)
        for (const { candidate, mid } of candidates) {
          this.log(`Add remote candidate: ${candidate} ${mid}`)
          peer.connection.addRemoteCandidate(candidate, mid)
        }
      } else {
        this.log('Skip to set remote description as signal state is stable')
      }
    })
    group.on('state', (state) => {
      this.state.connectionGroupState(state)
      this.emit('connection-group-state', state)
    })
    group.on('error', (err) => {
      if (err instanceof Error) this.error(err)
    })

    this.group = group
    this.state.connectionGroup(group.groupId)
    this.state.connectionGroupState(group.state)
    this.emit('connection-group', group.groupId)
    this.emit('connection-group-state', group.state)
  }

  protected async decode(description: string): Promise<TransferDescription> {
    return JSON.parse((await pBrotliDecompress(Buffer.from(description, 'base64'))).toString('utf-8'))
  }

  @Singleton(ops => JSON.stringify(ops))
  async initiate(options?: {
    id?: string
    session?: string
    initiate?: boolean
  }): Promise<string> {
    const initiator = !options?.id || options?.initiate || false
    const remoteId = options?.id
    const sessionId = options?.session || randomUUID()

    this.log(`Create peer connection to ${remoteId}. Is initiator: ${initiator}`)

    const conn = new PeerSession(sessionId, this.iceServers, {
      onHeartbeat: (id, ping) => {
        this.state.connectionPing({ id, ping })
        this.emit('connection-ping', { id, ping })
      },
      onInstanceShared: (id, manifest) => {
        this.state.connectionShareManifest({ id, manifest })
        this.emit('share', { id, manifest })
      },
      onDescriptorUpdate: (id, sdp, type, candidates) => {
        this.log(`Send local description ${remoteId}: ${sdp} ${type}`)
        this.log(candidates)
        if (remoteId) {
          this.group?.sendLocalDescription(remoteId, sdp, type, candidates)
        }
        const payload = { sdp, id: this.id, session: id, candidates }
        pBrotliCompress(JSON.stringify(payload)).then((s) => s.toString('base64')).then((compressed) => {
          this.state.connectionLocalDescription({ id: payload.session, description: compressed })
          this.emit('connection-local-description', { id: payload.session, description: compressed })
        })
      },
      onIdentity: (id, info) => {
        this.state.connectionUserInfo({ id, info })
        this.emit('connection-user-info', { id, info })
      },
      onLanMessage: (_, msg) => {
        if (!this.discover.isReady) {
          // this.discover.bind()
        } else {
          this.discover.broadcast(msg)
        }
      },
      getUserInfo: () => {
        // TODO: fix this
        const user = Object.values(this.userService.state.users)[0]
        const profile = user?.profiles[user.selectedProfile]
        return {
          name: profile?.name ?? 'Player',
          avatar: profile?.textures.SKIN.url ?? '',
          id: profile?.id ?? '',
          textures: profile?.textures ?? {
            SKIN: { url: '' },
          },
        }
      },
      getSharedInstance: () => this.sharedManifest,
      getShadedInstancePath: () => this.shareInstancePath,
      getSharedAssetsPath: () => this.getPath('assets'),
      getSharedLibrariesPath: () => this.getPath('libraries'),
      getSharedImagePath: (image) => join(this.imageStorage.root, image),
    }, this, this.portCandidate)

    if (remoteId) {
      conn.setRemoteId(remoteId)
    }

    conn.connection.onStateChange((state) => {
      const pair = conn.connection.getSelectedCandidatePair()
      if (pair) {
        this.log('Select pair %o', pair)
        this.state.connectionSelectedCandidate({
          id: conn.id,
          remote: pair.remote as any,
          local: pair.local as any,
        })
        this.emit('connection-selected-candidate', {
          id: conn.id,
          remote: pair.remote,
          local: pair.local,
        })
      }
      this.state.connectionStateChange({ id: conn.id, connectionState: state as any })
      if (state === 'closed') {
        if (conn.isClosed) {
          // Close by user manually
          delete this.peers[conn.id]
          this.state.connectionDrop(conn.id)
          this.emit('connection-drop', conn.id)
        } else {
          this.error(new Error(`Connection is closed unexpected! ${conn.id}`))
          if (this.group) {
            // Only delete if the group exist. Then it can re-connect automatically.
            delete this.peers[conn.id]
            this.state.connectionDrop(conn.id)
            this.emit('connection-drop', conn.id)
          }
        }
      }
    })
    conn.connection.onSignalingStateChange((state) => {
      this.state.signalingStateChange({ id: conn.id, signalingState: state as any })
      this.emit('signaling-state-change', { id: conn.id, signalingState: state })
    })
    conn.connection.onGatheringStateChange((state) => {
      this.state.iceGatheringStateChange({ id: conn.id, iceGatheringState: state as any })
      this.emit('ice-gathering-state-change', { id: conn.id, iceGatheringState: state })
    })

    this.state.connectionAdd({
      id: conn.id,
      initiator,
      userInfo: {
        name: '',
        id: '',
        textures: {
          SKIN: { url: '' },
        },
        avatar: '',
      },
      ping: -1,
      signalingState: 'closed',
      localDescriptionSDP: '',
      iceGatheringState: 'new',
      connectionState: 'new',
      sharing: undefined,
      selectedCandidate: undefined,
    })

    this.peers[conn.id] = conn

    if (initiator) {
      conn.initiate()
    }

    return conn.id
  }

  async offer(offer: string): Promise<string> {
    const o = await this.decode(offer) as TransferDescription
    const sess = await this.initiate({
      id: o.id,
      session: o.session,
      initiate: false,
    })
    const peer = this.peers[sess]
    peer.connection.setRemoteDescription(o.sdp, 'offer' as any)
    for (const c of o.candidates) {
      peer.connection.addRemoteCandidate(c.candidate, c.mid)
    }
    return sess
  }

  async answer(answer: string): Promise<void> {
    const o = await this.decode(answer) as TransferDescription
    const peer = this.peers[o.session]
    peer.setRemoteId(o.id)
    peer.connection.setRemoteDescription(o.sdp, 'answer' as any)
    for (const c of o.candidates) {
      peer.connection.addRemoteCandidate(c.candidate, c.mid)
    }
  }

  async drop(id: string): Promise<void> {
    const existed = this.peers[id]
    if (existed) {
      existed.close()
    }
  }

  createDownloadTask(url: string, destination: string, sha1: string, size?: number): BaseTask<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this
    class DownloadPeerFileTask extends AbortableTask<boolean> {
      private stream: Readable | undefined

      constructor(readonly url: string, readonly destination: string, readonly sha1: string, total: number) {
        super()
        this._to = destination
        this._from = url
        if (total !== 0) {
          this._total = total
        }
      }

      protected async process(): Promise<boolean> {
        const createDownloadStream = (url: string) => {
          const peerUrl = new URL(url)
          if (peerUrl.protocol !== 'peer:') {
            throw new Error(`Bad url: ${url}`)
          }
          const filePath = peerUrl.pathname
          const peer = self.peers[peerUrl.host]
          if (!peer) {
            throw new Error()
          }
          return peer.createReadStream(filePath)
        }

        this._total = this.total
        this._progress = 0
        this.update(0)
        await ensureFile(this.destination)

        let valid = (await self.worker.checksum(this.destination, 'sha1')) === this.sha1
        let limit = 3
        while (!valid && limit > 0) {
          this.stream = createDownloadStream(this.url)
          this.stream.on('data', (buf) => {
            this.update(buf.length)
          })
          await pipeline(this.stream, createWriteStream(this.destination))
          valid = (await self.worker.checksum(this.destination, 'sha1')) === this.sha1
          limit -= 1
        }
        if (!valid) {
          throw new ChecksumNotMatchError('sha1', this.sha1, await self.worker.checksum('sha1', this.destination), this.destination)
        }
        return true
      }

      protected abort(isCancelled: boolean): void {
        this.stream?.destroy(new Error('Abort'))
      }

      protected isAbortedError(e: any): boolean {
        return e.message === 'Abort'
      }
    }

    return new DownloadPeerFileTask(url, destination, sha1, size ?? 0)
  }

  async shareInstance(options: ShareInstanceOptions): Promise<void> {
    this.sharedManifest = options.manifest
    this.shareInstancePath = options.instancePath
    for (const sess of Object.values(this.peers)) {
      sess.send(MessageShareManifest, { manifest: options.manifest })
    }
  }
}
