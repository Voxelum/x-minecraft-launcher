import { EventEmitter } from 'events'
import { Manager } from '.'
import storeTemplate, { MutationKeys, MutationPayload, RootState } from '/@shared/store'
import { createStaticStore, StaticStore } from '../util/staticStore'

export default class StoreManager extends Manager {
  public store: StaticStore<RootState> = createStaticStore(storeTemplate as any, this) as any

  private eventbus = new EventEmitter()

  /**
   * The total order of the current store state.
   * One commit will make this id increment by one.
   */
  private checkPointId = 0

  private checkPoint: any

  sync(currentId: number) {
    const checkPointId = this.checkPointId
    this.log(`Sync from renderer: ${currentId}, main: ${checkPointId}.`)
    if (currentId === checkPointId) {
      return undefined
    }
    return {
      state: JSON.parse(JSON.stringify(this.checkPoint)),
      length: checkPointId,
    }
  }

  /**
   * Auto sync will watch every mutation and send to each client,
   * and it will response for `sync` channel which will send the mutation histories to the client.
   */
  private setupAutoSync() {
    this.store.subscribe((mutation, state) => {
      this.checkPoint = state
      this.checkPointId += 1 // record the total order
      // broadcast commit
      this.app.broadcast('commit', mutation, this.checkPointId)
    })
  }

  // SETUP CODE

  setup() {
    this.app.handle('sync', (_, id) => this.app.serviceReadyPromise.then(() => this.sync(id)))
    this.store.commit('root', this.app.gameDataPath)
    this.setupAutoSync()
    this.store.subscribe((mutation) => {
      this.eventbus.emit(mutation.type, mutation.payload)
    })
  }

  engineReady() {
    this.app.handle('commit', (event, type, payload) => {
      this.store!.commit(type, payload)
    })
  }

  subscribe<T extends MutationKeys>(key: T, listener: (payload: MutationPayload<T>) => void) {
    this.eventbus.addListener(key, listener)
    return this
  }

  subscribeAll(events: MutationKeys[], listener: () => void) {
    for (const e of events) {
      this.eventbus.addListener(e, listener)
    }
    return this
  }
}
