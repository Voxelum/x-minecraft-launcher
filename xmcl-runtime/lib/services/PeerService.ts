import { MinecraftLanBroadcaster, MinecraftLanDiscover } from '@xmcl/client'
import { ChecksumNotMatchError } from '@xmcl/installer'
import { InstanceManifest, PeerService as IPeerService, PeerServiceKey, PeerState, ShareInstanceOptions } from '@xmcl/runtime-api'
import { AbortableTask, BaseTask } from '@xmcl/task'
import { randomFill, randomUUID } from 'crypto'
import { createWriteStream } from 'fs'
import { ensureFile } from 'fs-extra'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { promisify } from 'util'
import { brotliCompress, brotliDecompress } from 'zlib'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { PeerGroup, TransferDescription } from '../entities/peer'
import { PeerSession } from '../entities/peer/connection'
import { MessageShareManifest } from '../entities/peer/messages/download'
import { MessageLan } from '../entities/peer/messages/lan'
import { Inject } from '../util/objectRegistry'
import { ExposeServiceKey, Lock, Singleton, StatefulService } from './Service'
import { UserService } from './UserService'

const pBrotliDecompress = promisify(brotliDecompress)
const pBrotliCompress = promisify(brotliCompress)

@ExposeServiceKey(PeerServiceKey)
export class PeerService extends StatefulService<PeerState> implements IPeerService {
  readonly peers: Record<string, PeerSession> = {}

  readonly broadcaster = new MinecraftLanBroadcaster()
  readonly discover = new MinecraftLanDiscover()
  /**
   * The unique id of this host
   */
  readonly id = randomUUID()

  private sharedManifest: InstanceManifest | undefined
  private shareInstancePath = ''

  private group: PeerGroup | undefined

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(UserService) private userService: UserService,
  ) {
    super(app, () => new PeerState(), async () => {
    })

    app.registerUrlHandler((url) => {
      const parsed = new URL(url, 'xmcl://launcher')
      if (parsed.host === 'launcher' && parsed.pathname === '/peer') {
        const params = parsed.searchParams
        const group = params.get('group')
        if (!group) {
          this.warn(`Ignore illegal peer join for group=${group}`)
          return false
        } else {
          this.joinGroup(group)
          return true
        }
      }
      return false
    })

    this.broadcaster.bind()
    this.discover.bind().then(() => {
      console.log('discover ready')
    })

    this.discover.on('discover', (info) => {
      for (const conn of Object.values(this.peers)) {
        if (conn.connection.state() !== 'connected') {
          continue
        }
        const selfMessage = conn.proxies.find(p => p.actualPortValue === info.port)
        // do not echo the proxy server you created
        if (!selfMessage) {
          conn.send(MessageLan, info)
        }
      }
    })
  }

  async leaveGroup(): Promise<void> {
    this.group?.quit()
    this.group = undefined
    this.state.connectionGroup('')
    this.state.connectionGroupState('closed')
  }

  @Lock('joinGroup')
  async joinGroup(id?: string): Promise<void> {
    if (this.group?.groupId && this.group.groupId === id) {
      return
    }

    if (this.group) {
      this.group.quit()
    }

    if (!id) {
      const buf = Buffer.alloc(2)
      await new Promise<Buffer>((resolve, reject) => randomFill(buf, (err, buf) => {
        if (err) reject(err)
        else resolve(buf)
      }))
      id = `${this.userService.state.gameProfile?.name ?? 'Player'}@${buf.readUint16BE()}`
    }
    const group = new PeerGroup(id, this.id)

    group.on('heartbeat', (sender) => {
      const peer = Object.values(this.peers).find(p => p.getRemoteId() === sender)
      // Ask sender to connect to me :)
      if (!peer) {
        this.log(`Not found the ${sender}. Initiate new connection`)
        if (this.id.localeCompare(sender) > 0) {
          // Only if my id is greater than other's id, we try to initiate the connection.
          // This will have a total order in the UUID random space

          // Try to connect to the sender
          this.initiate({ id: sender, initiate: true })
        }
      }
    })
    group.on('descriptor', (sender, sdp, type, candidates) => {
      let peer = Object.values(this.peers).find(p => p.getRemoteId() === sender)
      this.log(`Descriptor from ${sender}`)
      const newPeer = !peer
      if (!peer) {
        this.log(`Not found the ${sender}. Initiate new connection`)
        // Try to connect to the sender
        this.initiate({ id: sender, initiate: false })
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
    })
    group.on('error', (err) => {
      this.error(err)
    })

    this.group = group
    this.state.connectionGroup(group.groupId)
    this.state.connectionGroupState(group.state)
  }

  protected async decode(description: string): Promise<TransferDescription> {
    return JSON.parse((await pBrotliDecompress(Buffer.from(description, 'base64'))).toString('utf-8'))
  }

  @Singleton(id => id)
  async initiate(options?: {
    id?: string
    session?: string
    initiate?: boolean
  }): Promise<string> {
    const initiator = !options?.id || options?.initiate || false
    const remoteId = options?.id
    const sessionId = options?.session || randomUUID()

    this.log(`Create peer connection to ${remoteId}. Is initiator: ${initiator}`)

    const conn = new PeerSession(sessionId, {
      onHeartbeat: (id, ping) => this.state.connectionPing({ id, ping }),
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
        })
      },
      onIdentity: (id, info) => this.state.connectionUserInfo({ id, info }),
      onLanMessage: (_, msg) => { this.broadcaster.broadcast(msg) },
      getUserInfo: () => {
        const user = this.userService.state.user
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
    }, this)

    if (remoteId) {
      conn.setRemoteId(remoteId)
    }

    conn.connection.onStateChange((state) => {
      this.state.connectionStateChange({ id: conn.id, connectionState: state as any })
      if (state === 'closed') {
        if (conn.isClosed) {
          // Close by user manually
          delete this.peers[conn.id]
          this.state.connectionDrop(conn.id)
        } else {
          this.error(`Connection is closed unexpected! ${conn.id}`)
          if (this.group) {
            // Only delete if the group exist. Then it can re-connect automatically.
            delete this.peers[conn.id]
            this.state.connectionDrop(conn.id)
          }
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
          return peer.createDownloadStream(filePath)
        }

        this._total = this.total
        this._progress = 0
        this.update(0)
        await ensureFile(this.destination)

        let valid = (await self.worker().checksum(this.destination, 'sha1')) === this.sha1
        let limit = 3
        while (!valid && limit > 0) {
          this.stream = createDownloadStream(this.url)
          this.stream.on('data', (buf) => {
            this.update(buf.length)
          })
          await pipeline(this.stream, createWriteStream(this.destination))
          valid = (await self.worker().checksum(this.destination, 'sha1')) === this.sha1
          limit -= 1
        }
        if (!valid) {
          throw new ChecksumNotMatchError('sha1', this.sha1, await self.worker().checksum('sha1', this.destination), this.destination)
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
