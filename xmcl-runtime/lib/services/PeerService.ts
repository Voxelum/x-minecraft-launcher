import { MinecraftLanBroadcaster, MinecraftLanDiscover } from '@xmcl/client'
import { InstanceManifestSchema, PeerService as IPeerService, PeerServiceKey, PeerState, ShareInstanceOptions } from '@xmcl/runtime-api'
import { AbortableTask, BaseTask } from '@xmcl/task'
import { randomFill, randomUUID } from 'crypto'
import { createWriteStream } from 'fs'
import { createReadStream } from 'fs-extra'
import debounce from 'lodash.debounce'
import { DescriptionType } from 'node-datachannel'
import { join } from 'path'
import { Duplex } from 'stream'
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

  private sharedManifest: InstanceManifestSchema | undefined
  private shareInstancePath = ''

  private group: PeerGroup | undefined

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(UserService) private userService: UserService) {
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
    const group = await PeerGroup.join(id, this.id, (sender) => {
      // Ask sender to connect to me :)
      if (!this.peers[sender]) {
        // Try to connect to the sender
        this.initiate(sender, true)
      }
    }, (sender, sdp, type, candidates) => {
      if (!this.peers[sender]) {
        // Try to connect to the sender
        this.initiate(sender)
      }
      this.log(`Set remote description: ${sdp} ${type}`)
      this.log(candidates)
      const peer = this.peers[sender]
      peer.connection.setRemoteDescription(sdp, type)
      peer.descriptionSignal.resolve()
      for (const { candidate, mid } of candidates) {
        this.log(`Add remote candidate: ${candidate} ${mid}`)
        peer.connection.addRemoteCandidate(candidate, mid)
      }
    })
    this.group = group
    this.state.connectionGroup(group.groupId)
  }

  protected async decode(description: string): Promise<TransferDescription> {
    return JSON.parse((await pBrotliDecompress(Buffer.from(description, 'base64'))).toString('utf-8'))
  }

  @Singleton(id => id)
  async initiate(expectId?: string, initiate = false): Promise<string> {
    const setLocalDescription = debounce((payload) => {
      pBrotliCompress(JSON.stringify(payload)).then((s) => s.toString('base64')).then((compressed) => {
        this.state.connectionLocalDescription({ id: payload.session, description: compressed })
      })
    })

    const initiator = !expectId || initiate
    const id = expectId || randomUUID()

    this.log(`Create peer connection to ${id}. Is initiator: ${initiate}`)

    const conn = new PeerSession({
      onHeartbeat: (id, ping) => this.state.connectionPing({ id, ping }),
      onInstanceShared: (id, manifest) => {
        this.state.connectionShareManifest({ id, manifest })
        this.emit('share', { id, manifest })
      },
      onDescriptorUpdate: (sdp, type, candidates) => {
        this.log(`Send local description ${id}: ${sdp} ${type}`)
        this.log(candidates)
        this.group?.sendLocalDescription(id, sdp, type, candidates)
        setLocalDescription({ sdp, id, session: id })
      },
      onIdentity: (id, info) => this.state.connectionUserInfo({ id, info }),
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
      createSharedFileReadStream: (file) => {
        const man = this.sharedManifest
        if (!man) {
          return undefined
        }
        if (!man.files.some(v => v.path === file)) {
          return undefined
        }
        return createReadStream(join(this.shareInstancePath, file))
      },
      broadcaster: this.broadcaster,
    }, this, id)
    this.peers[id] = conn

    conn.connection.onStateChange((state) => {
      this.state.connectionStateChange({ id, connectionState: state as any })
    })
    conn.connection.onSignalingStateChange((state) => {
      this.state.signalingStateChange({ id, signalingState: state as any })
    })
    conn.connection.onGatheringStateChange((state) => {
      this.state.iceGatheringStateChange({ id, iceGatheringState: state as any })
    })

    this.state.connectionAdd({
      id,
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

    if (initiator) {
      conn.initiate()
    }

    return id
  }

  async offer(offer: string): Promise<string> {
    const o = await this.decode(offer) as TransferDescription
    await this.initiate(o.id)
    const peer = this.peers[o.id]
    peer.connection.setRemoteDescription(o.sdp, DescriptionType.Offer)
    return o.id
  }

  async answer(answer: string): Promise<void> {
    const o = await this.decode(answer) as TransferDescription
    const peer = this.peers[o.id]
    peer.connection.setRemoteDescription(o.sdp, DescriptionType.Answer)
  }

  async drop(id: string): Promise<void> {
    const existed = this.peers[id]
    if (existed) {
      existed.close()
    }
    delete this.peers[id]

    this.state.connectionDrop(id)
  }

  createDownloadStream(url: string) {
    const peerUrl = new URL(url)
    if (peerUrl.protocol !== 'peer:') {
      throw new Error(`Bad url: ${url}`)
    }
    const filePath = peerUrl.pathname
    const peer = this.peers[peerUrl.host]
    if (!peer) {
      throw new Error()
    }
    return peer.createDownloadStream(filePath)
  }

  createDownloadTask(url: string, destination: string, sha1: string, size?: number): BaseTask<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this
    class DownloadPeerFileTask extends AbortableTask<boolean> {
      private stream: Duplex | undefined

      constructor(readonly url: string, readonly destination: string, readonly sha1: string, total: number) {
        super()
        this._to = destination
        this._from = url
        if (total !== 0) {
          this._total = total
        }
      }

      protected async process(): Promise<boolean> {
        this._total = this.total
        this._progress = 0
        this.update(0)
        const stream = self.createDownloadStream(this.url)
        this.stream = stream
        stream.on('data', (buf) => {
          this.update(buf.length)
        })
        await pipeline(stream, createWriteStream(this.destination))
        return true
      }

      protected abort(isCancelled: boolean): void {
        this.stream?.destroy()
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
