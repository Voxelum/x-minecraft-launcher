import { Exception, GeneralException, ServiceKey } from '@xmcl/runtime-api'
import { Task } from '@xmcl/task'
import { Manager } from '.'
import { Client } from '../engineBridge'
import BaseService from '../services/BaseService'
import CurseForgeService from '../services/CurseForgeService'
import DiagnoseService from '../services/DiagnoseService'
import ExternalAuthSkinService from '../services/ExternalAuthSkinService'
import ImportService from '../services/ImportService'
import InstallService from '../services/InstallService'
import ModpackService from '../services/ModpackService'
import InstanceIOService from '../services/InstanceIOService'
import InstanceJavaService from '../services/InstanceJavaService'
import InstanceLogService from '../services/InstanceLogService'
import InstanceModsService from '../services/InstanceModsService'
import InstanceOptionsService from '../services/InstanceOptionsService'
import InstanceResourcePackService from '../services/InstanceResourcePacksService'
import InstanceSavesService from '../services/InstanceSavesService'
import InstanceService from '../services/InstanceService'
import InstanceShaderPacksService from '../services/InstanceShaderPacksService'
import InstanceVersionService from '../services/InstanceVersionService'
import JavaService from '../services/JavaService'
import LaunchService from '../services/LaunchService'
import { ModrinthService } from '../services/ModrinthService'
import ResourcePackPreviewService from '../services/ResourcePackPreviewService'
import ResourceService from '../services/ResourceService'
import ServerStatusService from '../services/ServerStatusService'
import AbstractService, { KEYS_SYMBOL, PARAMS_SYMBOL, ServiceConstructor, StatefulService, SUBSCRIBE_SYMBOL } from '../services/Service'
import UserService from '../services/UserService'
import VersionService from '../services/VersionService'
import LauncherApp from '../app/LauncherApp'
import { ObjectRegistry } from '../util/objectRegistry'

interface ServiceCallSession {
  id: number
  name: string
  pure: boolean
  call: () => Promise<any>
}

export default class ServiceManager extends Manager {
  private registeredServices: ServiceConstructor[] = []

  private activeServices: AbstractService[] = []

  /**
   * The service exposed to the remote
   */
  private exposedService: Record<string, AbstractService> = {}

  private usedSession = 0

  private sessions: { [key: number]: ServiceCallSession } = {}

  getService<T = AbstractService>(key: ServiceKey<T>): T | undefined {
    return this.exposedService[key as any] as any
  }

  protected addService<S extends AbstractService>(type: ServiceConstructor<S>) {
    this.registeredServices.push(type)
  }

  /**
   * Setup all services.
   */
  setupServices() {
    this.log(`Setup service ${this.app.gameDataPath}`)

    // create service instance
    const serviceMap = this.exposedService
    const injection = new ObjectRegistry()

    injection.register(LauncherApp as any, this.app)

    const discoverService = (ServiceConstructor: ServiceConstructor) => {
      if (injection.getObject(ServiceConstructor)) {
        return
      }
      const types = Reflect.get(ServiceConstructor, PARAMS_SYMBOL)
      const params: any[] = [this.app]
      if (types) {
        for (let i = 0; i < types.length; i++) {
          const type = types[i]
          if (type) {
            if (injection.getObject(type)) {
              // inject object
              params[i] = injection.getObject(type)
            } else if (Object.getPrototypeOf(type) === AbstractService || Object.getPrototypeOf(type) === StatefulService) {
              // injecting a service
              params[i] = discoverService(type)
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
      injection.register(ServiceConstructor, service)
      this.activeServices.push(service)
      const key = Reflect.get(ServiceConstructor, KEYS_SYMBOL)
      if (key) {
        serviceMap[key] = service
        this.log(`Expose service ${key} to remote`)
      } else {
        this.warn(`Unexposed the service ${ServiceConstructor.name}`)
      }

      const subscriptions = Reflect.get(service, SUBSCRIBE_SYMBOL)
      if (subscriptions) {
        for (const { mutations, handler } of subscriptions) {
          this.app.serviceStateManager.subscribeAll(mutations, handler.bind(service))
        }
      }

      return service
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
    await Promise.all(this.activeServices.map(s => s.initialize().catch((e) => {
      this.error(`Error during initialize service: ${Object.getPrototypeOf(s).constructor.name}`)
      this.error(e)
    }).finally(() => {
      this.app.emit('service-ready', s)
    })))

    this.log(`Successfully initialize services. Total Time is ${Date.now() - startingTime}ms.`)
  }

  /**
   * Start the specific service call from its id.
   * @param id The service call session id.
   */
  private async startServiceCall(id: number) {
    if (!this.sessions[id]) {
      this.error(`Unknown service call session ${id}!`)
    }
    try {
      const r = await this.sessions[id].call()
      return { result: r }
    } catch (e) {
      this.warn(`Error during service call session ${id}(${this.sessions[id].name}):`)
      if (e instanceof Error || typeof (e as any).stack === 'string') {
        this.error((e as any).stack)
      } else {
        this.error(JSON.stringify(e))
      }
      if (e instanceof Exception || 'type' in (e as any)) {
        return { error: e }
      }
      if (e instanceof Error) {
        return { error: new GeneralException({ type: 'general', error: e }) }
      }
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
    const serv = this.exposedService[service]
    if (!serv) {
      this.error(`Cannot execute service call ${name} from service ${service}. No service exposed as ${service}.`)
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
      this.error(`Cannot execute service call ${name} from service ${service}. The service doesn't have such method!`)
    }
    return undefined
  }

  dispose() {
    return Promise.all(this.activeServices.map((s) => s.dispose().catch((e) => {
      this.error(`Error during dispose ${Object.getPrototypeOf(s).constructor.name}:`)
      this.error(e)
    })))
  }

  // SETUP CODE

  async setup() {
    this.addService(BaseService)
    this.addService(CurseForgeService)
    this.addService(DiagnoseService)
    this.addService(ExternalAuthSkinService)
    this.addService(ImportService)
    this.addService(InstallService)
    this.addService(ModpackService)
    this.addService(InstanceOptionsService)
    this.addService(InstanceIOService)
    this.addService(InstanceLogService)
    this.addService(InstanceModsService)
    this.addService(InstanceResourcePackService)
    this.addService(InstanceSavesService)
    this.addService(InstanceService)
    this.addService(JavaService)
    this.addService(LaunchService)
    this.addService(ResourcePackPreviewService)
    this.addService(ResourceService)
    this.addService(ServerStatusService)
    this.addService(UserService)
    this.addService(VersionService)
    this.addService(InstanceVersionService)
    this.addService(InstanceJavaService)
    this.addService(InstanceShaderPacksService)
    this.addService(ModrinthService)

    this.setupServices()
    await this.initializeServices()
    this.app.emit('all-services-ready')
  }

  async engineReady() {
    this.log('Register service manager to handle ipc')
    this.app.handle('service-call', (e, service: string, name: string, payload: any) => this.handleServiceCall(e.sender, service, name, payload))
    this.app.handle('session', (_, id) => this.startServiceCall(id))
  }
}
