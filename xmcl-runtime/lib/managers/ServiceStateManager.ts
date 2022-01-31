import { State } from '@xmcl/runtime-api'
import { MutationKeys, MutationPayload } from '@xmcl/runtime-api/src/state'
import { EventEmitter } from 'events'
import { Manager } from '.'
import { ServiceStateProxy } from '../util/serviceProxy'

export default class ServiceStateManager extends Manager {
  private eventBus = new EventEmitter()

  private registeredState: Record<string, ServiceStateProxy> = {}

  subscribe<T extends MutationKeys>(key: T, listener: (payload: MutationPayload<T>) => void) {
    this.eventBus.addListener(key, listener)
    return this
  }

  subscribeAll(events: MutationKeys[], listener: () => void) {
    for (const e of events) {
      this.eventBus.addListener(e, listener)
    }
    return this
  }

  register<T extends State<T>>(serviceName: string, state: T): T {
    const proxy = new ServiceStateProxy(
      this.app,
      this.eventBus,
      serviceName,
      state,
      this,
    )
    this.registeredState[serviceName] = proxy
    return state
  }

  // SETUP CODE

  setup() {
    this.app.handle('sync', (_, serviceName, id) => {
      const service = this.app.serviceManager.getService(serviceName)
      if (service) {
        return service.initialize().then(() => {
          const stateProxy = this.registeredState[serviceName]
          if (stateProxy) {
            return stateProxy.takeSnapshot(id)
          }
        })
      }
    })
  }

  engineReady() {
    this.app.handle('commit', (event, serviceName, type, payload) => {
      const stateProxy = this.registeredState[serviceName]
      stateProxy.commit(type, payload)
    })
  }
}
