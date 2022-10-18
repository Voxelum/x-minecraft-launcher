import { InjectionKey } from 'vue'
import { Exception, ExceptionBase, isException, LaunchException, ServiceKey } from '@xmcl/runtime-api'
import { injection } from '../util/inject'

export function useExceptionHandler<T extends ExceptionBase>(type: { new(...args: any[]): Exception<T> }, handler: (e: T) => void) {
  const { exceptionHandlers } = injection(kExceptionHandlers)
  const key = type.name
  if (!exceptionHandlers[key]) {
    exceptionHandlers[key] = [type, [handler as any]]
  } else {
    exceptionHandlers[key][1].push(handler as any)
  }
}

export function useExceptionHandlerFromService<T>(serviceName: ServiceKey<T>, handler: (e: any, serviceName: string, serviceMethod: string) => void) {
  const { serviceErrorHandlers } = injection(kExceptionHandlers)
  const key = serviceName as string
  if (!serviceErrorHandlers[key]) {
    serviceErrorHandlers[key] = [handler]
  } else {
    serviceErrorHandlers[key].push(handler)
  }
}

export function useExceptionHandlers() {
  const exceptionHandlers: Record<string, [{ new(...args: any[]): Exception<any> }, Array<(e: unknown) => void>]> = {}
  const serviceErrorHandlers: Record<string, Array<(e: any, serviceName: string, serviceMethod: string) => void>> = {}
  window.addEventListener('unhandledrejection', (ev) => {
    const handler = exceptionHandlers[ev.reason.name]
    console.log(`Handle exception ${ev.reason.name} from ${ev.reason.serviceName}`)
    const errorHandler = ev.reason?.serviceName ? serviceErrorHandlers[ev.reason.serviceName] : undefined
    if (handler && isException(handler[0], ev.reason)) {
      console.log(`Found exception handler for exception ${ev.reason.name}`)
      handler[1].forEach(f => f(ev.reason.exception))
      ev.preventDefault()
    } else if (errorHandler) {
      console.log(`Found error handler for exception ${ev.reason.name}`)
      errorHandler.forEach(f => f(ev, ev.reason.serviceName, ev.reason.serviceMethod))
      ev.preventDefault()
    } else {
      console.log('Cannot found handler for exception:')
      console.log(ev)
    }
  })
  return {
    exceptionHandlers,
    serviceErrorHandlers,
  }
}

export const kExceptionHandlers: InjectionKey<ReturnType<typeof useExceptionHandlers>> = Symbol('ExceptionHandlers')
