import { Exception, ExceptionBase, isException } from '@xmcl/runtime-api'
import { InjectionKey } from 'vue'
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

export function useErrorHandler(handler: (e: unknown) => boolean) {
  const { errorHandlers } = injection(kExceptionHandlers)
  errorHandlers.push(handler)
}

export function useExceptionHandlers() {
  const exceptionHandlers: Record<string, [{ new(...args: any[]): Exception<any> }, Array<(e: unknown) => void>]> = {}
  const serviceErrorHandlers: Record<string, Array<(e: any, serviceName: string, serviceMethod: string) => void>> = {}
  const errorHandlers: Array<(e: unknown) => boolean> = []

  window.addEventListener('unhandledrejection', (ev) => {
    const exHandler = exceptionHandlers[ev.reason.name]
    console.log(`Handle exception ${ev.reason.name} from ${ev.reason.serviceName}`)
    const servHandler = ev.reason?.serviceName ? serviceErrorHandlers[ev.reason.serviceName] : undefined
    if (exHandler && isException(exHandler[0], ev.reason)) {
      console.log(`Found exception handler for exception ${ev.reason.name}`)
      exHandler[1].forEach(f => f(ev.reason.exception))
      ev.preventDefault()
    } else if (servHandler) {
      console.log(`Found error handler for exception ${ev.reason.name}`)
      servHandler.forEach(f => f(ev, ev.reason.serviceName, ev.reason.serviceMethod))
      ev.preventDefault()
    } else {
      for (const handler of errorHandlers) {
        if (handler(ev.reason)) {
          ev.preventDefault()
          return
        }
      }
      console.log('Cannot found handler for exception:')
      console.log(ev)
    }
  })
  return {
    exceptionHandlers,
    serviceErrorHandlers,
    errorHandlers,
  }
}

export const kExceptionHandlers: InjectionKey<ReturnType<typeof useExceptionHandlers>> = Symbol('ExceptionHandlers')
