import { ServiceKey } from '@xmcl/runtime-api'
import { Client, LauncherAppPlugin } from '../app'
import { AnyError, serializeError } from '../util/error'
import { AbstractService, ServiceConstructor, getServiceKey } from './Service'
import { isStateObject } from './stateUtils'
import { ServiceStateManager } from './ServiceStateManager'

export const pluginServicesHandler = (services: ServiceConstructor[]): LauncherAppPlugin => (app, manifest) => {
  const logger = app.getLogger('Services')
  const registered: Record<string, ServiceConstructor> = {}
  const instances: Record<string, AbstractService> = {}

  const serviceStateManager = new ServiceStateManager(app)
  app.registry.register(ServiceStateManager, serviceStateManager)

  const get = async<T extends AbstractService>(skey: ServiceKey<T>, serviceMethod: string): Promise<T> => {
    if (!instances[skey as string]) {
      const ServiceConstructor = registered[skey as string]
      if (!ServiceConstructor) {
        throw new AnyError('ServiceNotFoundError', `Cannot execute service call ${serviceMethod} from service ${skey}.`)
      }
      const service = await app.registry.getOrCreate(ServiceConstructor)

      instances[skey as string] = service
      logger.log(`Create service ${skey as string}`)
      await service.initialize()

      return service as T
    }
    return instances[skey as string] as T
  }

  /**
   * Handle a service call from a client.
   *
   * If the result of the service call is a state object, this will try to trace the sync state of the state object.
   *
   * @param client The client calling this service
   * @param serviceName The service name
   * @param serviceMethod The service function name
   * @param payload The payload
   * @returns The service call result
   */
  const handleServiceCall = async (client: Client, serviceName: string, serviceMethod: string, ...payload: any[]) => {
    let serv: AbstractService | undefined
    try {
      serv = await get(serviceName, serviceMethod)
    } catch (error) {
      if (error instanceof Error) logger.error(error)
      return { error }
    }

    if (typeof (serv as any)[serviceMethod] !== 'function') {
      const error = new AnyError('ServiceMethodNotFoundError', `Cannot execute service call ${serviceMethod} from service ${serviceName}. The service doesn't have such method!`, undefined, { method: serviceMethod })
      logger.error(error)
      return { error }
    }

    const start = Date.now()
    try {
      const r = await (serv as any)[serviceMethod](...payload)
      app.emit('service-call-end', serviceName, serviceMethod, Date.now() - start, true)
      if (isStateObject(r)) {
        return { result: serviceStateManager.serializeAndTrack(client, r) }
      }
      return { result: r }
    } catch (e) {
      app.emit('service-call-end', serviceName, serviceMethod, Date.now() - start, false)
      logger.warn(`Error during service call ${serviceName}.${serviceMethod}:`)
      if (e instanceof Error) {
        Object.assign(e, { payload })
        logger.error(e, serviceName)
      } else {
        logger.error(new AnyError('UnknownServiceError', JSON.stringify(e), undefined, { payload }), serviceName)
      }
      const error = await serializeError(e)
      error.serviceName = serviceName
      error.serviceMethod = serviceMethod
      return { error }
    }
  }

  app.controller.handle('service-call', (e, service: string, name: string, ...payload: any[]) => handleServiceCall(e.sender, service, name, ...payload))

  for (const type of services) {
    const key = getServiceKey(type)
    if (key) {
      registered[key] = type
    }
  }
}
