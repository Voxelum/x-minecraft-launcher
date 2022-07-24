import { State, MutationKeys, MutationPayload } from '@xmcl/runtime-api'
import { EventEmitter } from 'events'
import { Manager } from '.'
import LauncherApp from '../app/LauncherApp'
import { AbstractService } from '../services/Service'
import { ServiceStateProxy } from '../util/serviceProxy'

export default class ServiceStateManager extends Manager {
  private logger = this.app.logManager.getLogger('ServiceStateManager')
  private eventBus = new EventEmitter()

  private registeredState: Record<string, ServiceStateProxy> = {}

  constructor(app: LauncherApp) {
    super(app)
    app.handle('sync', (_, serviceName, id) => {
      const service = app.serviceManager.getServiceByKey(serviceName)
      if (service) {
        return (service as AbstractService).initialize().then(() => {
          const stateProxy = this.registeredState[serviceName]
          if (stateProxy) {
            return stateProxy.takeSnapshot(id)
          }
        })
      }
    })
    app.handle('commit', (event, serviceName, type, payload) => {
      const stateProxy = this.registeredState[serviceName]
      stateProxy.commit(type, payload)
    })
  }

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
      this.logger,
    )
    this.registeredState[serviceName] = proxy
    return state
  }
}
