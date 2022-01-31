/* eslint-disable no-dupe-class-members */

import { ServiceChannels, ServiceKey } from '@xmcl/runtime-api'
import { contextBridge, ipcRenderer } from 'electron'
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

function createServiceChannels(): ServiceChannels {
  const servicesEmitter = new Map<ServiceKey<any>, EventEmitter>()

  ipcRenderer.on('commit', (event, serviceName, ...args) => {
    const em = servicesEmitter.get(serviceName)
    if (em) {
      em.emit('commit', ...args)
    }
  })

  ipcRenderer.on('service-event', (_, { service, event, args }) => {
    const emitter = servicesEmitter.get(service)
    if (emitter) {
      emitter.emit(event, ...args)
    }
  })

  return {
    open(serviceKey) {
      if (!servicesEmitter.has(serviceKey)) {
        servicesEmitter.set(serviceKey, new EventEmitter())
      }
      const emitter = servicesEmitter.get(serviceKey)!
      return {
        sync(id?: number) {
          return ipcRenderer.invoke('sync', serviceKey, id)
        },
        commit(key: string, payload: any): void {
          ipcRenderer.invoke('commit', serviceKey, key, payload)
        },
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
        call(method, payload) {
          const promise: Promise<any> = ipcRenderer.invoke('service-call', serviceKey, method, payload).then((sessionId: any) => {
            if (typeof sessionId !== 'number') {
              throw new Error(`Cannot find service call named ${method} in ${serviceKey}`)
            }
            return waitSessionEnd(sessionId, (id) => emitter.emit('task', { name: method, promise, sessionId, id }))
          })
          return promise
        },
      }
    },
  }
}

contextBridge.exposeInMainWorld('serviceChannels', createServiceChannels())
