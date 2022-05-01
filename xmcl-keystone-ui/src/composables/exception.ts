import { InjectionKey } from '@vue/composition-api'
import { Exception, ExceptionBase, isException, LaunchException } from '@xmcl/runtime-api'
import { injection } from '../util/inject'

export function useExceptionHandler<T extends ExceptionBase>(type: { new(...args: any[]): Exception<T> }, handler: (e: T) => void) {
  const handlers = injection(ExceptionHandlersKey)
  const key = type.name
  if (!handlers[key]) {
    handlers[key] = [type, [handler as any]]
  } else {
    handlers[key][1].push(handler as any)
  }
}

export function useExceptionHandlers() {
  const handlers: Record<string, [{ new(...args: any[]): Exception<any> }, Array<(e: unknown) => void>]> = {}
  window.addEventListener('unhandledrejection', (ev) => {
    const handler = handlers[ev.reason.name]
    if (handler && isException(handler[0], ev.reason)) {
      handler[1].forEach(f => f(ev.reason.exception))
      ev.preventDefault()
    }
  })
  return handlers
}

export const ExceptionHandlersKey: InjectionKey<ReturnType<typeof useExceptionHandlers>> = Symbol('ExceptionHandlers')
