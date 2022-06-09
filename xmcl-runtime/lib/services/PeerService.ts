import { ConnectionState, ConnectionUserInfo, IceGatheringState, InstanceManifestSchema, PeerService as IPeerService, PeerServiceKey, PeerState, ShareInstanceOptions, SignalingState } from '@xmcl/runtime-api'
import { AbortableTask, BaseTask } from '@xmcl/task'
import debounce from 'lodash.debounce'
import LauncherApp from '../app/LauncherApp'
import { createPromiseSignal } from '../util/promiseSignal'
import { Singleton, StatefulService } from './Service'
import { brotliCompress, brotliDecompress } from 'zlib'
import { promisify } from 'util'
import { randomUUID } from 'crypto'
import { rename } from 'fs-extra'

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
  on(event: 'download-progress', handler: (event: { id: number; chunkSize: number }) => void): this
  on(event: 'peer-heartbeat', handler: (event: { id: string; ping: number }) => void): this

  create(id: string): Promise<void>
  initiate(id: string): Promise<void>
  offer(offer: object): Promise<string>
  answer(answer: object): Promise<void>
  drop(id: string): Promise<void>
  shareInstance(path: string, manifest?: InstanceManifestSchema): Promise<void>

  download(options: { url: string; destination: string; sha1: string; size: number; id: number }): Promise<boolean>
  downloadAbort(options: { id: number }): Promise<boolean>
}

export class PeerService extends StatefulService<PeerState> implements IPeerService {
  private delegate: PeerServiceWebRTCFacade | undefined
  private signal = createPromiseSignal()
  private downloadId = 0
  private downloadCallbacks: Record<number, undefined | ((chunk: number) => void)> = {}

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
          ping: -1,
          signalingState: 'closed',
          localDescriptionSDP: '',
          iceGatheringState: 'new',
          connectionState: 'new',
          sharing: undefined,
        })
      })
      .on('shared-instance-manifest', ({ id, manifest }) => {
        this.state.connectionShareManifest({ id, manifest })
        this.emit('share', { id, manifest })
      })
      .on('download-progress', ({ id, chunkSize }) => {
        this.downloadCallbacks[id]?.(chunkSize)
      })
      .on('peer-heartbeat', ({ id, ping }) => {
        this.state.connectionPing({ id, ping })
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

  downloadTask(url: string, destination: string, sha1: string, size?: number): BaseTask<boolean> {
    const callbacks = this.downloadCallbacks
    class DownloadPeerFileTask extends AbortableTask<boolean> {
      constructor(readonly url: string, readonly destination: string, readonly sha1: string, total: number, readonly downloadId: number, readonly delegate: PeerServiceWebRTCFacade) {
        super()
        this._to = destination
        this._from = url
        if (total !== 0) {
          this._total = total
        }
      }

      protected async process(): Promise<boolean> {
        callbacks[this.downloadId] = (chunk) => {
          this._progress += chunk
          this.update(chunk)
        }
        const destination = this.destination + '.pending'
        const result = await this.delegate.download({
          url: this.url,
          destination,
          sha1: this.sha1,
          size: this.total,
          id: this.downloadId,
        })
        await rename(destination, this.destination)
        if (this.isPaused || this.isCancelled) {
          throw new Error('Abort')
        }
        delete callbacks[this.downloadId]
        return result
      }

      protected abort(isCancelled: boolean): void {
        this.delegate.downloadAbort({ id: this.downloadId })
      }

      protected isAbortedError(e: any): boolean {
        return e.message === 'Abort'
      }
    }

    return new DownloadPeerFileTask(url, destination, sha1, size ?? 0, this.downloadId++, this.delegate!)
  }

  async shareInstance(options: ShareInstanceOptions): Promise<void> {
    await this.signal.promise
    return await this.delegate!.shareInstance(options.instancePath, options.manifest)
  }
}
