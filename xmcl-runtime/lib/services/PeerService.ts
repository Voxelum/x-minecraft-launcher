import { PeerService as IPeerService, PeerServiceKey, PeerState, ShareInstanceOptions } from '@xmcl/runtime-api'
import { BaseTask } from '@xmcl/task'
import LauncherApp from '../app/LauncherApp'
import { createPromiseSignal } from '../util/promiseSignal'
import { StatefulService } from './Service'

export class PeerService extends StatefulService<PeerState> implements IPeerService {
  private delegate: Pick<PeerService, 'initiate' | 'offer' | 'answer' | 'drop' | 'create' | 'downloadTask' | 'shareInstance'> | undefined
  private signal = createPromiseSignal()

  constructor(app: LauncherApp) {
    super(app, PeerServiceKey, () => new PeerState())
  }

  setDelegate(delegate: Pick<PeerService, 'initiate' | 'offer' | 'answer' | 'drop' | 'create' | 'downloadTask' | 'shareInstance'>) {
    this.delegate = delegate
    this.signal.resolve()
  }

  async create(): Promise<string> {
    await this.signal.promise
    const result = await this.delegate!.create()
    return result
  }

  async initiate(id: string): Promise<void> {
    await this.signal.promise
    await this.delegate!.initiate(id)
  }

  async offer(offer: string): Promise<string> {
    await this.signal.promise
    return await this.delegate!.offer(offer)
  }

  async answer(answer: string): Promise<void> {
    await this.signal.promise
    return await this.delegate!.answer(answer)
  }

  async drop(id: string): Promise<void> {
    await this.signal.promise
    return await this.delegate!.drop(id)
  }

  async downloadTask(url: string, destination: string, sha1: string): Promise<BaseTask<boolean>> {
    await this.signal.promise
    return await this.delegate!.downloadTask(url, destination, sha1)
  }

  async shareInstance(options: ShareInstanceOptions): Promise<void> {
    await this.signal.promise
    return await this.delegate!.shareInstance(options)
  }
}
