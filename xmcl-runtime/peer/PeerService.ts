import { MinecraftLanDiscover } from '@xmcl/client'
import { ChecksumNotMatchError } from '@xmcl/file-transfer'
import { PeerService as IPeerService, InitiateOptions, InstanceManifest, MutableState, PeerServiceKey, PeerState, SetRemoteDescriptionOptions, Settings, ShareInstanceOptions, TransferDescription } from '@xmcl/runtime-api'
import { AbortableTask, BaseTask } from '@xmcl/task'
import { randomUUID } from 'crypto'
import { createWriteStream } from 'fs'
import { ensureFile } from 'fs-extra'
import { join } from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { promisify } from 'util'
import { brotliCompress, brotliDecompress } from 'zlib'
import { Inject, LauncherApp, LauncherAppKey, PathResolver, kGameDataPath } from '~/app'
import { IS_DEV } from '~/constant'
import { kIceServerProvider } from '~/iceServers'
import { ImageStorage } from '~/imageStore'
import { NatService } from '~/nat'
import { ExposeServiceKey, ServiceStateManager, Singleton, StatefulService } from '~/service'
import { kSettings } from '~/settings'
import { ResourceWorker, kResourceWorker } from '../resource'
import { UserService } from '../user'
import { NodeDataChannelModule } from './NodeDataChannel'
import { PeerSession } from './connection'
import { mapLocalPort, parseCandidate } from './mapAndGetPortCanidate'
import { MessageShareManifest } from './messages/download'
import { MessageLan } from './messages/lan'

const pBrotliDecompress = promisify(brotliDecompress)
const pBrotliCompress = promisify(brotliCompress)

@ExposeServiceKey(PeerServiceKey)
export class PeerService extends StatefulService<PeerState> implements IPeerService {
  readonly peers: Record<string, PeerSession> = {}

  readonly discover = new MinecraftLanDiscover()
  readonly discoverV6 = new MinecraftLanDiscover('udp6')

  private sharedManifest: InstanceManifest | undefined
  private shareInstancePath = ''

  private portCandidate = 35565

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ImageStorage) private imageStorage: ImageStorage,
    @Inject(ServiceStateManager) store: ServiceStateManager,
    @Inject(kResourceWorker) private worker: ResourceWorker,
    @Inject(kGameDataPath) private getPath: PathResolver,
    @Inject(kSettings) private settings: Settings,
    @Inject(NatService) private natService: NatService,
    @Inject(UserService) private userService: UserService,
  ) {
    super(app, () => store.registerStatic(new PeerState(), PeerServiceKey), async () => {
      // mapAndGetPortCandidate(natService, this.portCandidate, this).then(port => {
      //   this.portCandidate = port
      // }, (e) => {
      //   this.warn('Fail to init nat', e)
      // })
    })

    app.registryDisposer(async () => {
      for (const peer of Object.values(this.peers)) {
        peer.close()
      }
      this.discover.destroy()
      this.discoverV6.destroy()
    })

    NodeDataChannelModule.init(this.getAppDataPath())
    const logger = this.app.getLogger('wrtc', 'wrtc')
    if (IS_DEV) {
      NodeDataChannelModule.getInstance().then(m => {
        m.initLogger('Verbose', (level, message) => {
          if (level === 'Info' || level === 'Debug' || level === 'Verbose') {
            logger.log(message)
          } else if (level === 'Fatal' || level === 'Error') {
            logger.warn(message)
          } else if (level === 'Warning') {
            logger.warn(message)
          }
        })
      })
    } else {
      NodeDataChannelModule.getInstance().then(m => {
        m.initLogger('Info', (level, message) => {
          if (level === 'Info' || level === 'Debug' || level === 'Verbose') {
            logger.log(message)
          } else if (level === 'Fatal' || level === 'Error') {
            logger.warn(message)
          } else if (level === 'Warning') {
            logger.warn(message)
          }
        })
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

    this.discoverV6.bind().then(() => {
      this.log('Minecraft LAN V6 discover ready')
    }, (e) => {
      this.error(new Error('Fail to bind Minecraft LAN V6 discover', { cause: e }))
    })

    this.discover.on('discover', (info) => {
      const peers = Object.values(this.peers).filter(c => c.connection.state() === 'connected')
      for (const conn of peers) {
        if (conn.isOnSameLan()) {
          return
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

    this.discoverV6.on('discover', (info) => {
      const peers = Object.values(this.peers).filter(c => c.connection.state() === 'connected')
      for (const conn of peers) {
        if (conn.isOnSameLan()) {
          return
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

  protected async decode(description: string): Promise<TransferDescription> {
    return JSON.parse((await pBrotliDecompress(Buffer.from(description, 'base64'))).toString('utf-8'))
  }

  protected async getLocalIp(hideSubnet = false) {
    const ip = await this.natService.getNatState().then((s) => s.localIp, () => '')
    if (!ip) return ip
    const isIPV6 = ip.split(':').length === 8
    if (hideSubnet) {
      if (isIPV6) {
        return ip.split(':').slice(0, 4).join(':')
      }
      return ip.split('.').slice(0, 3).join('.')
    }
    return ip
  }

  @Singleton(ops => JSON.stringify(ops))
  async initiate(options: InitiateOptions): Promise<string> {
    const initiator = !options.remoteId || options.initiate || false
    const remoteId = options.remoteId
    const gameProfile = options.gameProfile
    const sessionId = options.session || randomUUID() // `${await this.getLocalIp(true)}-${randomUUID()}`

    this.log(`Create peer connection to ${remoteId}. Is initiator: ${initiator}`)
    const natService = this.natService
    const privatePort = this.portCandidate
    const iceServers = await this.app.registry.get(kIceServerProvider)

    const conn = await PeerSession.createPeerSession(sessionId, iceServers.getIceServers(this.settings.allowTurn), {
      onHeartbeat: (session, ping) => {
        this.state.connectionPing({ id: session, ping })
      },
      onInstanceShared: (session, manifest) => {
        this.state.connectionShareManifest({ id: session, manifest })
        this.emit('share', { id: session, manifest })
      },
      onDescriptorUpdate: async (session, sdp, type, candidates) => {
        this.log(`Send local description ${remoteId}: ${sdp} ${type}`)
        this.log(candidates)

        const candidate = candidates.find(c => c.candidate.indexOf('typ srflx') !== -1)
        if (candidate) {
          const [ip, port] = parseCandidate(candidate.candidate)
          if (ip && port) {
            const state = await natService.getNatState()
            await mapLocalPort(natService, state.localIp, privatePort, Number(port), this).catch((e) => {
              if (e.name === 'Error') { e.name = 'MapNatError' }
              this.error(e)
            })
          }
        }
        const payload = { sdp, id: remoteId, session, candidates }
        this.emit('connection-local-description', { type, description: payload })
        pBrotliCompress(JSON.stringify(payload)).then((s) => s.toString('base64')).then((compressed) => {
          this.state.connectionLocalDescription({ id: payload.session, description: compressed })
        })
      },
      onIdentity: (session, info) => {
        this.state.connectionUserInfo({ id: session, info })
      },
      onLanMessage: (_, msg) => {
        if (!this.discover.isReady) {
          // this.discover.bind()
        } else {
          this.discover.broadcast(msg)
        }
        if (!this.discoverV6.isReady) {
          // this.discoverV6.bind()
        } else {
          this.discoverV6.broadcast(msg)
        }
      },
      getUserInfo: () => {
        const _user = Object.values(this.userService.state.users)[0]
        const profile = gameProfile ?? Object.values(this.userService.state.users)[0]?.profiles[_user.selectedProfile]
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
    }, this, privatePort)

    if (remoteId) {
      this.state.connectionRemoteSet({ id: conn.id, remoteId })
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
      }
      this.state.connectionStateChange({ id: conn.id, connectionState: state as any })
      if (state === 'closed') {
        if (conn.isClosed) {
          // Close by user manually
          delete this.peers[conn.id]
          this.state.connectionDrop(conn.id)
        } else {
          this.error(new Error(`Connection is closed unexpected! ${conn.id}`))
        }
      }
    })
    conn.connection.onSignalingStateChange((state) => {
      this.state.signalingStateChange({ id: conn.id, signalingState: state as any })
    })
    conn.connection.onGatheringStateChange((state) => {
      this.state.iceGatheringStateChange({ id: conn.id, iceGatheringState: state as any })
    })

    this.state.connectionAdd({
      id: conn.id,
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

  async setRemoteDescription({ description, gameProfile, type }: SetRemoteDescriptionOptions) {
    const desc = typeof description === 'string' ? await this.decode(description) : description
    const { sdp, candidates, id: sender, session } = desc
    let sess = this.peers[session] ?? Object.values(this.peers).find(p => p.getRemoteId() === sender)
    const newPeer = !sess
    if (!sess) {
      this.log(`Not found the ${sender}. Initiate new connection`)
      // Try to connect to the sender
      await this.initiate({ remoteId: sender, session, initiate: false, gameProfile })
      sess = this.peers[session] ?? Object.values(this.peers).find(p => p.getRemoteId() === sender)!
    }
    this.log(`Set remote ${type} description: ${sdp}`)
    this.log(candidates)
    const state = sess.connection.signalingState()
    if (state !== 'stable' || newPeer) {
      try {
        sess.connection.setRemoteDescription(sdp, type as any)
        for (const { candidate, mid } of candidates) {
          this.log(`Add remote candidate: ${candidate} ${mid}`)
          sess.connection.addRemoteCandidate(candidate, mid)
        }
      } catch (e) {
        if (e instanceof Error && e.name === 'Error') {
          e.name = 'SetRemoteDescriptionError'
        }
        throw e
      }
    } else {
      this.log('Skip to set remote description as signal state is stable')
    }
    return sess.id
  }

  async drop(id: string): Promise<void> {
    const existed = this.peers[id]
    if (existed) {
      existed.close()
      this.state.connectionDrop(id)
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
