import { Disposable, MutationKeys, MutationPayload, State } from '@xmcl/runtime-api'
import { EventEmitter } from 'events'
import { Manager } from '.'
import LauncherApp from '../app/LauncherApp'
import { AbstractService } from '../services/Service'
import { ServiceStateProxy } from '../util/serviceProxy'

export const kStateKey = Symbol('StateKey')

export default class ServiceStateManager extends Manager {
  private logger = this.app.logManager.getLogger('ServiceStateManager')
  private eventBus = new EventEmitter()

  private registeredState: Record<string, ServiceStateProxy> = {}

  constructor(app: LauncherApp) {
    super(app)
    app.controller.handle('sync', async (_, serviceName, id) => {
      const service = app.serviceManager.getServiceByKey(serviceName)
      if (!service) return 'NOT_FOUND_SERVICE'
      await (service as AbstractService).initialize()
      const stateProxy = this.registeredState[serviceName]
      if (!stateProxy) return 'NOT_STATE_SERVICE'
      return stateProxy.takeSnapshot(id)
    })
    app.controller.handle('commit', (event, serviceName, type, payload) => {
      const stateProxy = this.registeredState[serviceName]
      stateProxy.commit(type, payload)
    })
  }

  subscribe<T extends MutationKeys>(key: T, listener: (payload: MutationPayload<T>) => void) {
    this.eventBus.addListener(key, listener)
    return this
  }

  unsubscribe<T extends MutationKeys>(key: T, listener: (payload: MutationPayload<T>) => void) {
    this.eventBus.removeListener(key, listener)
    return this
  }

  subscribeAll(events: MutationKeys[], listener: () => void) {
    for (const e of events) {
      this.eventBus.addListener(e, listener)
    }
    return this
  }

  register<T extends State<T>>(serviceName: string, state: T, dispose?: () => void): Disposable<T> {
    const proxy = new ServiceStateProxy(
      this.app,
      this.eventBus,
      serviceName,
      state,
      this.logger,
    )
    this.registeredState[serviceName] = proxy
    Object.defineProperty(state, kStateKey, serviceName)
    return state
  }
}
