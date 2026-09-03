import { Exception, ServiceKey, type ServiceCallTraceContext } from '@xmcl/runtime-api'
import { SpanStatusCode, type Span } from '@opentelemetry/api'
import { Client, LauncherAppPlugin } from '../app'
import { AbstractService, ServiceConstructor, getServiceKey } from './Service'
import { ServiceStateManager } from './ServiceStateManager'
import { isStateObject } from './stateUtils'
import { AnyError } from '@xmcl/utils'
import {
  getNormalizeException,
  getSerializedError,
  getServiceFailureCategory,
} from '~/infra/errors'
import {
  runWithRendererServiceTrace,
  runWithServiceTrace,
  trackRuntimeExceptionOnce,
} from '~/infra'

export const pluginServicesHandler =
  (services: ServiceConstructor[]): LauncherAppPlugin =>
  (app, manifest) => {
    const logger = app.getLogger('Services')
    const registered: Record<string, ServiceConstructor> = {}
    const instances: Record<string, AbstractService> = {}

    const serviceStateManager = new ServiceStateManager(app)
    app.registry.register(ServiceStateManager, serviceStateManager)

    const get = async <T extends AbstractService>(
      skey: ServiceKey<T>,
      serviceMethod: string,
    ): Promise<T> => {
      if (!instances[skey as string]) {
        const ServiceConstructor = registered[skey as string]
        if (!ServiceConstructor) {
          throw new AnyError(
            'ServiceNotFoundError',
            `Cannot execute service call ${serviceMethod} from service ${skey}.`,
          )
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
    const handleServiceCall = async (
      client: Client,
      serviceName: string,
      serviceMethod: string,
      span: Span | undefined,
      ...payload: any[]
    ) => {
      let serv: AbstractService | undefined
      try {
        serv = await get(serviceName, serviceMethod)
      } catch (error) {
        span?.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        })
        trackRuntimeExceptionOnce(error, {
          'error.operation': 'service-initialize',
          'rpc.service': serviceName,
          'rpc.method': serviceMethod,
        })
        if (error instanceof Error) {
          logger.error(error)
        }
        return {
          error: await getSerializedError(error, {
            origin: 'runtime-service',
            serviceName,
            serviceMethod,
          }),
        }
      }

      if (typeof (serv as any)[serviceMethod] !== 'function') {
        const error = new AnyError(
          'ServiceMethodNotFoundError',
          `Cannot execute service call ${serviceMethod} from service ${serviceName}. The service doesn't have such method!`,
          undefined,
          { method: serviceMethod },
        )
        span?.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
        trackRuntimeExceptionOnce(error, {
          'error.operation': 'service-dispatch',
          'rpc.service': serviceName,
          'rpc.method': serviceMethod,
        })
        logger.error(error)
        return {
          error: await getSerializedError(error, {
            origin: 'runtime-service',
            serviceName,
            serviceMethod,
          }),
        }
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
        app.emit(
          'service-call-end',
          serviceName,
          serviceMethod,
          Date.now() - start,
          false,
          getServiceFailureCategory(e),
        )
        const exception = await getNormalizeException(e)
        const knownException = e instanceof Exception ? e : exception
        const err =
          e instanceof Error
            ? e
            : new AnyError(
                'ServiceUnknownError',
                typeof e === 'string' ? e : JSON.stringify(e),
                undefined,
              )

        if (knownException) {
          span?.setAttribute('error.type', knownException.exception.type)
          span?.setStatus({
            code: SpanStatusCode.ERROR,
            message: knownException.exception.type,
          })
        } else {
          span?.setStatus({ code: SpanStatusCode.ERROR, message: err.message })
          trackRuntimeExceptionOnce(err, {
            'error.operation': 'service-call',
            'rpc.service': serviceName,
            'rpc.method': serviceMethod,
          })
          logger.warn(`Error during service call ${serviceName}.${serviceMethod}:`)
          logger.error(err, serviceName)
        }

        // serailize the error and send to client
        const error = await getSerializedError(exception || e, {
          origin: 'runtime-service',
          serviceName,
          serviceMethod,
          remoteStack: e instanceof Error ? e.stack : undefined,
        })
        return { error }
      }
    }

    const handleTracedServiceCall = (
      client: Client,
      traceContext: ServiceCallTraceContext | undefined,
      service: string,
      name: string,
      payload: any[],
    ) =>
      traceContext
        ? runWithRendererServiceTrace(traceContext, service, name, (span) =>
            handleServiceCall(client, service, name, span, ...payload),
          )
        : runWithServiceTrace(undefined, service, name, (span) =>
            handleServiceCall(client, service, name, span, ...payload),
          )

    app.controller.handle('service-call', (e, service: string, name: string, ...payload: any[]) => {
      return handleTracedServiceCall(e.sender, undefined, service, name, payload)
    })
    app.controller.handle(
      'service-call-traced',
      (
        e,
        traceContext: ServiceCallTraceContext,
        service: string,
        name: string,
        ...payload: any[]
      ) => {
        return handleTracedServiceCall(e.sender, traceContext, service, name, payload)
      },
    )

    for (const type of services) {
      const key = getServiceKey(type)
      if (key) {
        registered[key] = type
      }
    }
  }
