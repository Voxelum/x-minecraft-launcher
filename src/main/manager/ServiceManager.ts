import { Task } from '@xmcl/task'
import { Manager } from '.'
import LauncherApp from '../app/LauncherApp'
import { Client } from '/@main/engineBridge'
import AbstractService, { registeredServices, ServiceConstructor } from '/@main/service/Service'
import { toRecord } from '/@shared/util/object'
import { aquire, isBusy, release } from '/@shared/util/semaphore'

interface ServiceCallSession {
  id: number
  name: string
  pure: boolean
  call: () => Promise<any>
}

function createProxyForService<T>(): [T, (v: T) => void] {
  let target: any
  const p: T = new Proxy({} as any, {
    get(_, p) {
      return target[p]
    },
    has(_, p) {
      return !!target[p]
    },
    ownKeys(_) {
      return Object.keys(target)
    },
  })
  const set = (v: T) => {
    target = v
  }
  return [p, set]
}

export default class ServiceManager extends Manager {
  private registeredServices: Record<string, ServiceConstructor> = toRecord(registeredServices, (s) => Reflect.getMetadata('service:key', s))

  private services: AbstractService[] = []

  private activeServices = new Map<ServiceConstructor, AbstractService>()

  private usedSession = 0

  private sessions: { [key: number]: ServiceCallSession } = {}

  private semaphore: Record<string, number> = {}

  getService<T extends ServiceConstructor>(service: T): InstanceType<T> | undefined {
    return this.activeServices.get(Object.getPrototypeOf(service).constructor) as any
  }

  protected registerService(s: ServiceConstructor) { this.registeredServices[s.name] = s }

  /**
   * Aquire and boradcast the key is in used.
   * @param key The key or keys to aquire
   */
  aquire(key: string | string[]) {
    aquire(this.semaphore, key)
    this.app.broadcast('aquire', key)
  }

  /**
   * Release and boradcast the key is not used.
   * @param key The key or keys to release
   */
  release(key: string | string[]) {
    release(this.semaphore, key)
    this.app.broadcast('release', key)
  }

  /**
   * Determine if a key is in used.
   * @param key key value representing some operation
   */
  isBusy(key: string) {
    return isBusy(this.semaphore, key)
  }

  /**
   * Setup all services.
   */
  setupServices() {
    this.log(`Setup service ${this.app.gameDataPath}`)

    // create service instance
    const serviceMap: Map<ServiceConstructor, AbstractService> = this.activeServices
    const loaded: Set<ServiceConstructor> = new Set()

    const discoverService = (ServiceConstructor: ServiceConstructor) => {
      if (serviceMap.has(ServiceConstructor)) {
        return serviceMap.get(ServiceConstructor)
      }
      if (loaded.has(ServiceConstructor)) {
        throw new Error('Circular Service dependencies!')
      }

      const types = Reflect.getMetadata('design:paramtypes', ServiceConstructor)
      const params: any[] = []
      for (const type of types) {
        if (type === LauncherApp) {
          // injecting app
          params.push(this.app)
        } else if (Object.getPrototypeOf(type) === AbstractService) {
          // injecting a service
          params.push(discoverService(type))
        } else {
          throw new Error(`Cannot inject type ${type} to service ${type.name}!`)
        }
      }

      const serv = new ServiceConstructor(...params)
      serviceMap.set(ServiceConstructor, serv)
      return serv
    }

    for (const ServiceConstructor of [...Object.values(this.registeredServices)]) {
      discoverService(ServiceConstructor)
    }
  }

  /**
   * Load all the services
   */
  async initializeServices() {
    const startingTime = Date.now()
    await Promise.all(this.services.map(s => s.initialize().catch((e) => {
      this.error(`Error during initialize service: ${Object.getPrototypeOf(s).constructor.name}`)
      this.error(e)
    })))

    this.log(`Successfully initialize services. Total Time is ${Date.now() - startingTime}ms.`)
  }

  /**
   * Initialize all the services
   */
  async initializeService() {
    // wait app ready since in the init stage, the module can access network & others
    const startingTime = Date.now()
    await Promise.all(this.services.map(s => s.initialize().catch((e) => {
      this.error(`Error during service init ${Object.getPrototypeOf(s).constructor.name}:`)
      this.error(e)
    })))
    this.log(`Successfully init modules. Total Time is ${Date.now() - startingTime}ms.`)
  }

  /**
   * Start the specific service call from its id.
   * @param id The service call session id.
   */
  startServiceCall(id: number) {
    if (!this.sessions[id]) {
      this.error(`Unknown service call session ${id}!`)
    }
    try {
      const r = this.sessions[id].call()
      if (r instanceof Promise) {
        return r.then(r => ({ result: r }), (e) => {
          this.warn(`Error during service call session ${id}(${this.sessions[id].name}):`)
          this.warn(e)
          this.warn(e.stack)
          return { error: { object: e, errorMessage: e.toString() } }
        })
      }
      return { result: r }
    } catch (e) {
      this.warn(`Error during service call session ${id}(${this.sessions[id].name}):`)
      this.error(e)
      return { error: e }
    }
  }

  /**
   * Prepare a service call from a client. It will return the service call id.
   *
   * This will start a session in this manager.
   * To exectute this service call session, you shoul call `handleSession`
   *
   * @param client The client calling this service
   * @param service The service name
   * @param name The service function name
   * @param payload The payload
   * @returns The service call session id
   */
  prepareServiceCall(client: Client, service: string, name: string, payload: any): number | undefined {
    const serv = this.activeServices.get(this.registeredServices[service])
    if (!serv) {
      this.error(`Cannot execute service call ${name} from service ${service}. The service not found.`)
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
      this.error(`Cannot execute service call ${name} from service ${serv}. The service doesn't have such method!`)
    }
    return undefined
  }

  dispose() {
    return Promise.all(this.services.map((s) => s.dispose().catch((e) => {
      this.error(`Error during dispose ${Object.getPrototypeOf(s).constructor.name}:`)
      this.error(e)
    })))
  }

  // SETUP CODE

  async setup() {
    this.setupServices()
    await this.initializeServices()
    this.app.emit('store-ready', this.app.storeManager.store)
  }

  async engineReady() {
    this.app.handle('service-call', (e, service: string, name: string, payload: any) => this.prepareServiceCall(e.sender, service, name, payload))
    this.app.handle('session', (_, id) => this.startServiceCall(id))
    this.initializeService()
  }
}
