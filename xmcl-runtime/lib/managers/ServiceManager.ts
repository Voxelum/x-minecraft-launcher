import { Exception, ServiceKey } from '@xmcl/runtime-api'
import { Task } from '@xmcl/task'
import { Manager } from '.'
import LauncherApp from '../app/LauncherApp'
import { Client } from '../engineBridge'
import { AbstractService, PARAMS_SYMBOL, ServiceConstructor, StatefulService } from '../services/Service'
import { serializeError } from '../util/error'
import { ObjectRegistry } from '../util/objectRegistry'

interface ServiceCallSession {
  id: number
  name: string
  pure: boolean
  call: () => Promise<any>
}

export default class ServiceManager extends Manager {
  private servicesMap: Record<string, AbstractService> = {}
  private servicesInstanceMap: ObjectRegistry = new ObjectRegistry()
  private logger = this.app.logManager.getLogger('ServiceManager')

  private usedSession = 0

  private sessions: { [key: number]: ServiceCallSession } = {}

  constructor(app: LauncherApp, private preloadServices: ServiceConstructor[]) {
    super(app)

    this.app.handle('service-call', (e, service: string, name: string, payload: any) => this.handleServiceCall(e.sender, service, name, payload))
    this.app.handle('session', (_, id) => this.startServiceCall(id))
  }

  getServiceByKey<T>(type: ServiceKey<T>): T | undefined {
    return this.servicesMap[type as string] as any
  }

  getOrCreateService<T extends AbstractService>(ServiceConstructor: ServiceConstructor<T>): T {
    const existed = this.servicesInstanceMap.getObject(ServiceConstructor)
    if (existed) {
      return existed
    }
    const types = Reflect.get(ServiceConstructor, PARAMS_SYMBOL)
    const params: any[] = new Array(types?.length || 1)
    params[0] = this.app
    if (types) {
      for (let i = 0; i < types.length; i++) {
        const type = types[i]
        if (type) {
          if (type instanceof LauncherApp) {
            params[i] = this.app
          } else if (this.servicesInstanceMap.getObject(type)) {
            // inject object
            params[i] = this.servicesInstanceMap.getObject(type)
          } else if (Object.getPrototypeOf(type) === AbstractService || Object.getPrototypeOf(type) === StatefulService) {
            // injecting a service
            params[i] = this.getOrCreateService(type)
            if (!params[i]) {
              throw new Error(`Cannot find service ${type}`)
            }
          } else {
            throw new Error(`Cannot inject type ${type} to service ${type.name}!`)
          }
        }
      }
    }

    const service = new ServiceConstructor(...params)
    this.servicesInstanceMap.register(ServiceConstructor, service)
    const key = service.name
    this.servicesMap[key as string] = service
    this.logger.log(`Expose service ${key} to remote`)

    service.initialize()

    return service
  }

  /**
   * Start the specific service call from its id.
   * @param id The service call session id.
   */
  private async startServiceCall(id: number) {
    if (!this.sessions[id]) {
      this.logger.error(`Unknown service call session ${id}!`)
    }
    const sess = this.sessions[id]
    const [serviceName, serviceMethod] = sess.name.split('.')
    try {
      const r = await this.sessions[id].call()
      return { result: r }
    } catch (e) {
      this.logger.warn(`Error during service call session ${id}(${this.sessions[id].name}):`)
      if (e instanceof Error) {
        this.logger.error(e)
      } else {
        this.logger.error(JSON.stringify(e))
      }
      if (e instanceof Exception) {
        this.logger.error(JSON.stringify(e.exception, null, 4))
      }
      const error = serializeError(e)
      error.serviceName = serviceName
      error.serviceMethod = serviceMethod
      return { error }
    } finally {
      delete this.sessions[id]
    }
  }

  /**
   * Prepare a service call from a client. It will return the service call id.
   *
   * This will start a session in this manager.
   * To execute this service call session, you should call `handleSession`
   *
   * @param client The client calling this service
   * @param service The service name
   * @param name The service function name
   * @param payload The payload
   * @returns The service call session id
   */
  private handleServiceCall(client: Client, service: string, name: string, payload: any): number | undefined {
    const serv = this.servicesMap[service]
    if (!serv) {
      this.logger.error(`Cannot execute service call ${name} from service ${service}. No service exposed as ${service}.`)
    } else {
      if (name in serv) {
        const tasks: Task<any>[] = []
        const sessionId = this.usedSession++
        const taskManager = this.app.taskManager
        const submit = (task: Task<any>) => {
          const promise = taskManager.submit(task)
          client.send(`session-${sessionId}`, (task.context as any).uuid)
          tasks.push(task)
          return promise
        }
        /**
          * Create a proxy to this specific service call to record the tasks it submit
          */
        const servProxy: any = new Proxy(serv, {
          get(target, key) {
            if (key === 'submit') { return submit }
            return Reflect.get(target, key)
          },
        })
        const session: ServiceCallSession = {
          call: () => servProxy[name](payload),
          name: `${service}.${name}`,
          pure: false,
          id: sessionId,
        }

        this.sessions[sessionId] = session

        return sessionId
      }
      this.logger.error(`Cannot execute service call ${name} from service ${service}. The service doesn't have such method!`)
    }
    return undefined
  }

  async setup() {
    this.logger.log(`Setup service ${this.app.gameDataPath}`)

    for (const ServiceConstructor of [...Object.values(this.preloadServices)]) {
      this.getOrCreateService(ServiceConstructor)
    }
  }

  /**
   * Dispose all services
   */
  async dispose() {
    await Promise.all(Object.values(this.servicesMap).map((s) => s.dispose().catch((e) => {
      this.logger.error(`Error during dispose ${Object.getPrototypeOf(s).constructor.name}:`)
      this.logger.error(e)
    })))
  }
}
