import { ConnectionState, ConnectionUserInfo, IceGatheringState, InstanceManifestSchema, PeerService as IPeerService, PeerServiceKey, PeerState, ShareInstanceOptions, SignalingState } from '@xmcl/runtime-api'
import { AbortableTask, BaseTask } from '@xmcl/task'
import debounce from 'lodash.debounce'
import LauncherApp from '../app/LauncherApp'
import { createPromiseSignal } from '../util/promiseSignal'
import { Singleton, StatefulService } from './Service'
import { brotliCompress, brotliDecompress } from 'zlib'
import { promisify } from 'util'
import { randomUUID } from 'crypto'

const pBrotliDecompress = promisify(brotliDecompress)
const pBrotliCompress = promisify(brotliCompress)

export interface PeerServiceWebRTCFacade {
  on(event: 'localDescription', handler: (desc: object) => void): this
  on(event: 'connectionstatechange', handler: (event: { id: string; state: ConnectionState }) => void): this
  on(event: 'icegatheringstatechange', handler: (event: { id: string; state: IceGatheringState }) => void): this
  on(event: 'signalingstatechange', handler: (event: { id: string; state: SignalingState }) => void): this
  on(event: 'identity', handler: (event: { id: string; info: ConnectionUserInfo }) => void): this
  on(event: 'connection', handler: (event: { id: string }) => void): this
  on(event: 'shared-instance-manifest', handler: (event: { id: string; manifest: InstanceManifestSchema }) => void): this

  create(id: string): Promise<void>
  initiate(id: string): Promise<void>
  offer(offer: object): Promise<string>
  answer(answer: object): Promise<void>
  drop(id: string): Promise<void>
  shareInstance(manifest?: InstanceManifestSchema): Promise<void>

  download(options: { url: string; destination: string; sha1: string }): Promise<boolean>
  downloadAbort(options: { url: string }): Promise<boolean>
}

export class PeerService extends StatefulService<PeerState> implements IPeerService {
  private delegate: PeerServiceWebRTCFacade | undefined
  private signal = createPromiseSignal()

  constructor(app: LauncherApp) {
    super(app, PeerServiceKey, () => new PeerState())
  }

  setDelegate(delegate: PeerServiceWebRTCFacade) {
    this.delegate = delegate
    this.signal.resolve()

    const setLocalDescription = debounce((payload) => {
      pBrotliCompress(JSON.stringify(payload)).then((s) => s.toString('base64')).then((compressed) => {
        this.state.connectionLocalDescription({ id: payload.session, description: compressed })
      })
    })

    this.app.on('peer-join', async ({ description, type }) => {
      if (type === 'offer') {
        const offer = await this.decode(description)
        await delegate.offer(offer)
      } else {
        const answer = await this.decode(description)
        await delegate.answer(answer)
      }
    })

    delegate
      .on('localDescription', async (payload) => {
        setLocalDescription(payload)
      })
      .on('connectionstatechange', ({ id, state }) => {
        this.state.connectionStateChange({ id: id, connectionState: state })
      })
      .on('icegatheringstatechange', ({ id, state }) => {
        this.state.iceGatheringStateChange({ id: id, iceGatheringState: state })
      })
      .on('signalingstatechange', ({ id, state }) => {
        this.state.signalingStateChange({ id: id, signalingState: state })
      })
      .on('identity', ({ id, info }) => {
        this.state.connectionUserInfo({ id, info })
      })
      .on('connection', ({ id }) => {
        this.state.connectionAdd({
          id,
          initiator: true,
          userInfo: {
            name: '',
            avatar: '',
          },
          signalingState: 'closed',
          localDescriptionSDP: '',
          iceGatheringState: 'new',
          connectionState: 'new',
          sharing: undefined,
        })
      })
      .on('shared-instance-manifest', ({ id, manifest }) => {
        this.state.connectionShareManifest({ id, manifest })
      })
  }

  protected async decode(description: string): Promise<object> {
    return JSON.parse((await pBrotliDecompress(Buffer.from(description, 'base64'))).toString('utf-8'))
  }

  async create(): Promise<string> {
    const id = randomUUID()
    await this.signal.promise
    await this.delegate!.create(id)
    return id
  }

  @Singleton(id => id)
  async initiate(id: string): Promise<void> {
    await this.signal.promise
    await this.delegate!.initiate(id)
  }

  @Singleton(id => id)
  async offer(offer: string): Promise<string> {
    const o = await this.decode(offer)
    await this.signal.promise
    const id = await this.delegate!.offer(o)
    return id
  }

  @Singleton(id => id)
  async answer(answer: string): Promise<void> {
    const o = await this.decode(answer)
    await this.signal.promise
    return await this.delegate!.answer(o)
  }

  async drop(id: string): Promise<void> {
    await this.signal.promise
    await this.delegate!.drop(id)
    this.state.connectionDrop(id)
  }

  async downloadTask(url: string, destination: string, sha1: string): Promise<BaseTask<boolean>> {
    const delegate = this.delegate!
    class DownloadPeerFileTask extends AbortableTask<boolean> {
      constructor(readonly url: string, readonly destination: string, readonly sha1: string) {
        super()
        this._to = destination
        this._from = url
      }

      protected async process(): Promise<boolean> {
        const result = delegate.download({
          url: this.url,
          destination: this.destination,
          sha1: this.sha1,
        })
        return result
      }

      protected abort(isCancelled: boolean): void {
        delegate.downloadAbort({ url: this.url })
      }

      protected isAbortedError(e: any): boolean {
        return false
      }
    }

    return new DownloadPeerFileTask(url, destination, sha1)
  }

  async shareInstance(options: ShareInstanceOptions): Promise<void> {
    await this.signal.promise
    return await this.delegate!.shareInstance(options.manifest)
  }
}
