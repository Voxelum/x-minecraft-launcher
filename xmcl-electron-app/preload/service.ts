/* eslint-disable no-dupe-class-members */

import { ServiceCallTaskListener, ServiceChannel as IServiceChannel, ServiceKey } from '@xmcl/runtime-api'
import { ipcRenderer } from 'electron'
import EventEmitter from 'events'

async function waitSessionEnd(sessionId: number, listener: (task: string) => void) {
  ipcRenderer.on(`session-${sessionId}`, (e, task) => listener(task))
  try {
    const { result, error } = await ipcRenderer.invoke('session', sessionId)
    if (error) {
      if (error.errorMessage) {
        error.toString = () => error.errorMessage
      }
      return Promise.reject(error)
    }
    return result
  } finally {
    ipcRenderer.removeListener(`session-${sessionId}`, listener)
  }
}

function createServiceCallerFunction(serviceKey: ServiceKey<any>, name: string, resultDeco: ServiceCallTaskListener) {
  const func = function (payload: any) {
    const promise: Promise<any> = ipcRenderer.invoke('service-call', serviceKey, name, payload).then((sessionId: any) => {
      if (typeof sessionId !== 'number') {
        throw new Error(`Cannot find service call named ${name} in ${serviceKey}`)
      }
      return waitSessionEnd(sessionId, (id) => resultDeco(serviceKey, name, promise, sessionId, id))
    })
    return promise
  }
  Object.defineProperty(func, 'name', { value: name, enumerable: false, writable: false, configurable: false })
  return func
}

export function createServiceChannel(): IServiceChannel {
  const emitter = new EventEmitter()
  const servicesEmitter = new Map<ServiceKey<any>, EventEmitter>()

  ipcRenderer.on('commit', (event, ...args) => {
    emitter.emit('commit', ...args)
  })

  ipcRenderer.on('service-event', (_, { service, event, args }) => {
    const serv = servicesEmitter.get(service)
    if (serv) {
      serv.emit(event, ...args)
    }
  })

  return {
    sync(id?: number): Promise<{ state: any; length: number }> {
      return ipcRenderer.invoke('sync', id)
    },

    commit(key: string, payload: any): void {
      ipcRenderer.invoke('commit', key, payload)
    },

    createServiceProxy(serviceKey, template, taskListener) {
      const serv: Record<string, any> = {
      }
      if ('on' in template || 'once' in template || 'removeListener' in template) {
        if (!servicesEmitter.has(serviceKey)) {
          servicesEmitter.set(serviceKey, new EventEmitter())
        }
        const emitter = servicesEmitter.get(serviceKey)!
        Object.assign(serv, {
          on(channel: any, listener: any) {
            emitter.on(channel, listener)
            return this
          },
          once(channel: any, listener: any) {
            emitter.once(channel, listener)
            return this
          },
          removeListener(channel: any, listener: any) {
            emitter.removeListener(channel, listener)
            return this
          },
        })
      }
      for (const key of Object.keys(template)) {
        if (key === 'state' || key === 'on' || key === 'once' || key === 'removeListener') {
          continue
        }
        serv[key] = createServiceCallerFunction(serviceKey, key, taskListener || (() => { }))
      }
      return serv as any
    },

    on(channel, listener) {
      emitter.on(channel, listener)
      return this
    },

    once(channel, listener) {
      emitter.once(channel, listener)
      return this
    },

    removeListener(channel, listener) {
      emitter.removeListener(channel, listener)
      return this
    },
  }
}
