import { ServiceKey } from '@xmcl/runtime-api'
import { Manager } from '.'
import LauncherApp from '../app/LauncherApp'
import { Client } from '../engineBridge'
import { AbstractService, ServiceConstructor, getServiceKey } from '../services/Service'
import { serializeError } from '../util/error'
interface ServiceCallSession {
  id: number
  name: string
  pure: boolean
  call: () => Promise<any>
}

export default class ServiceManager extends Manager {
  private logger = this.app.logManager.getLogger('ServiceManager')

  private usedSession = 0

  private sessions: { [key: number]: ServiceCallSession } = {}

  private serviceConstructorMap: Record<string, ServiceConstructor> = {}
  private servicesMap: Record<string, AbstractService> = {}

  constructor(app: LauncherApp, private preloadServices: ServiceConstructor[]) {
    super(app)

    this.app.controller.handle('service-call', (e, service: string, name: string, payload: any) => this.handleServiceCall(e.sender, service, name, payload))
    this.app.controller.handle('session', (_, id) => this.startServiceCall(id))

    for (const type of preloadServices) {
      const key = getServiceKey(type)
      if (key) {
        this.serviceConstructorMap[key] = type
      }
    }
  }

  getServiceByKey<T>(type: ServiceKey<T>): T | undefined {
    const service = this.servicesMap[type as string] as any
    if (!service) {
      const con = this.serviceConstructorMap[type as string]
      if (con) {
        return this.get(con) as any
      }
    }
    return service
  }

  get<T extends AbstractService>(ServiceConstructor: ServiceConstructor<T>): T {
    const service = this.app.registry.get(ServiceConstructor)
    if (!service) {
      throw new Error(`Fail construct service ${ServiceConstructor.name}!`)
    }

    const key = getServiceKey(ServiceConstructor)
    if (!this.servicesMap[key]) {
      this.servicesMap[key] = service
      this.logger.log(`Expose service ${key} to remote`)
      service.initialize()
    }

    return service
  }

  /**
   * Start the specific service call from its id.
   * @param id The service call session id.
   */
  private async startServiceCall(id: number) {
    if (!this.sessions[id]) {
      this.logger.error(new RangeError(`Unknown service call session ${id}!`))
    }
    const sess = this.sessions[id]
    const [serviceName, serviceMethod] = sess.name.split('.')
    try {
      const r = await this.sessions[id].call()
      return { result: r }
    } catch (e) {
      this.logger.warn(`Error during service call session ${id}(${this.sessions[id].name}):`)
      if (e instanceof Error) {
        this.logger.error(e, serviceName)
      } else {
        this.logger.error(new Error(JSON.stringify(e)), serviceName)
      }
      const error = await serializeError(e)
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
      this.logger.error(new Error(`Cannot execute service call ${name} from service ${service}. No service exposed as ${service}.`))
    } else {
      if (name in serv) {
        const sessionId = this.usedSession++

        const session: ServiceCallSession = {
          call: () => (serv as any)[name](payload),
          name: `${service}.${name}`,
          pure: false,
          id: sessionId,
        }

        this.sessions[sessionId] = session

        return sessionId
      }
      this.logger.error(new Error(`Cannot execute service call ${name} from service ${service}. The service doesn't have such method!`))
    }
    return undefined
  }

  async setup() {
    this.logger.log(`Setup service ${this.app.gameDataPath}`)

    for (const ServiceConstructor of [...Object.values(this.preloadServices)]) {
      this.get(ServiceConstructor)
    }
  }

  /**
   * Dispose all services
   */
  async dispose() {
    this.logger.log('Dispose all services')
    await Promise.all(Object.values(this.servicesMap).map((s) => s.dispose().catch((e) => {
      this.logger.error(new Error(`Error during dispose ${Object.getPrototypeOf(s).constructor.name}:`, { cause: e }))
    })))
    this.logger.log('All services are disposed')
  }
}
