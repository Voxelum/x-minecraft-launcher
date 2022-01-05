import { EventEmitter } from 'events'
import { Manager } from '.'
import { isState } from '../services/Service'
import { State } from '/@shared/services/Service'
import { MutationKeys, MutationPayload } from '/@shared/state'

export default class StoreManager extends Manager {
  private eventbus = new EventEmitter()

  /**
   * The total order of the current store state.
   * One commit will make this id increment by one.
   */
  private checkPointId = 0

  private registeredState: Record<string, any> = {}

  private mutations: Record<string, Array<(payload: any) => void>> = {}

  snapshot(currentId: number) {
    const checkPointId = this.checkPointId
    this.log(`Sync from renderer: ${currentId}, main: ${checkPointId}.`)
    if (currentId === checkPointId) {
      return undefined
    }
    return {
      state: JSON.parse(JSON.stringify(this.registeredState)),
      length: checkPointId,
    }
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

  register<T extends State<T>>(name: string, state: T): T {
    const bus = this.eventbus
    const mutations = this.mutations
    const stateKeys = [] as string[]
    const update = (key: string, value: any) => {
      this.checkPointId += 1
      app.broadcast('commit', { type: key, payload: value }, this.checkPointId)
      bus.emit(key, value)
    }
    const app = this.app
    for (const [key, prop] of Object.entries(Object.getOwnPropertyDescriptors(Object.getPrototypeOf(state)))) {
      if (key !== 'constructor' && prop.value instanceof Function) {
        const original = prop.value
        // eslint-disable-next-line no-inner-declarations
        function wrapped(this: any, value: any) {
          original.call(this, value)
          update(key, value)
        }
        mutations[key] = wrapped.bind(state) as any
        Reflect.set(state, key, wrapped)
      }
    }
    for (const [key, prop] of Object.entries(Object.getOwnPropertyDescriptors(state))) {
      if (!prop.get) {
        if (prop.value) {
          if (!isState(prop.value)) {
            stateKeys.push(key)
          }
        } else {
          stateKeys.push(key)
        }
      }
    }
    this.registeredState[name] = {
      toJSON() {
        const obj = {} as any
        for (const key of stateKeys) {
          obj[key] = (state as any)[key]
        }
        return obj
      },
    }
    return state
  }

  // SETUP CODE

  setup() {
    this.app.handle('sync', (_, id) => this.app.serviceReadyPromise.then(() => this.snapshot(id)))
  }

  engineReady() {
    this.app.handle('commit', (event, type, payload) => {
      this.mutations[type].forEach(m => m(payload))
    })
  }
}
