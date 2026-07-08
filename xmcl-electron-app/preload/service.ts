/* eslint-disable no-dupe-class-members */

import type { ServiceChannels, ServiceKey, SharedState } from '@xmcl/runtime-api'
import { contextBridge, ipcRenderer } from 'electron'
import EventEmitter from 'events'

// NOTE: this preload is intentionally a "dumb pipe". It does NOT import the
// state classes from `@xmcl/runtime-api` (doing so drags the whole command
// registry + zod schemas into every preload bundle). Because the main window
// uses contextIsolation, the renderer keeps its own copy of each state object
// and applies mutations itself using the class it already passes to `useState`
// (see xmcl-keystone-ui/src/composables/syncableState.ts). The renderer also
// installs the mutation-forwarding methods there, calling the generic
// `commit(method, ...args)` channel exposed below.

const kEmitter = Symbol('Emitter')

function createSharedState<T extends object>(val: T, id: string): SharedState<T> {
  const emitter = new EventEmitter()
  Object.defineProperty(val, kEmitter, { value: emitter })
  return Object.assign(val, {
    subscribe(key: string, listener: (payload: any) => void) {
      emitter.addListener(key, listener)
      return this
    },
    unsubscribe(key: string, listener: (payload: any) => void) {
      emitter.removeListener(key, listener)
      return this
    },
    subscribeAll(listener: (payload: any) => void) {
      emitter.addListener('*', listener)
      return this
    },
    unsubscribeAll(listener: (payload: any) => void) {
      emitter.removeListener('*', listener)
      return this
    },
    commit(method: string, ...args: any[]) {
      return ipcRenderer.invoke('commit', id, method, ...args)
    },
    revalidate() {
      ipcRenderer.invoke('revalidate', id)
    },
  }) as any
}

if (process.env.NODE_ENV === 'development') {
  console.log('serivce.ts preload')
}

async function receive(_result: any, states: Record<string, WeakRef<SharedState<any>>>, pendingCommits: Record<string, { type: string; payload: any }[]>, gc: FinalizationRegistry<string>) {
  if (typeof _result !== 'object') {
    return
  }
  const { result, error } = _result
  if (error) {
    if (error.errorMessage) {
      error.toString = () => error.errorMessage
    }
    return Promise.reject(error)
  }

  if (result && typeof result === 'object' && '__state__' in result) {
    // recover state object
    const id = result.id

    if (states[id] && states[id].deref()) {
      console.log(`reuse state ${id}`)
      const state = states[id].deref()
      // try to overwrite the state
      Object.assign(state, result)
      return states[id].deref()
    }

    delete result.__state__
    const state = createSharedState(result, id)

    gc.register(state, state.id)

    states[id] = new WeakRef(state)

    queueMicrotask(() => {
      if (pendingCommits[id]) {
        for (const mutation of pendingCommits[id]) {
          (state as any)[kEmitter].emit(mutation.type, mutation.payload);
          (state as any)[kEmitter].emit('*', mutation.type, mutation.payload)
        }
        delete pendingCommits[id]
      }
    })

    return state
  }

  return result
}

function createServiceChannels(): ServiceChannels {
  const gc = new FinalizationRegistry<string>((id) => {
    delete states[id]
    ipcRenderer.invoke('unref', id)
    console.log(`deref ${id}`)
  })
  const servicesEmitters = new Map<ServiceKey<any>, WeakRef<EventEmitter>>()
  const states: Record<string, WeakRef<SharedState<object>>> = {}
  const pendingCommits: Record<string, { type: string; payload: any }[]> = {}

  ipcRenderer.on('state-validating', (_, { id, semaphore }) => {
    const state = states[id]?.deref()
    if (state) {
      (state as any)[kEmitter].emit('state-validating', semaphore)
    }
  })

  ipcRenderer.on('service-event', (_, { service, event, args }) => {
    const emitter = servicesEmitters.get(service)?.deref()
    if (emitter) {
      emitter.emit(event, ...args)
    }
  })

  ipcRenderer.on('commit', (_, id, type, payload) => {
    const state = states[id]?.deref()
    if (state) {
      (state as any)[kEmitter].emit(type, payload);
      (state as any)[kEmitter].emit('*', type, payload)
    } else {
      // pending commit
      if (!pendingCommits[id]) {
        pendingCommits[id] = []
      }
      pendingCommits[id].push({ type, payload })
    }
  })

  return {
    open(serviceKey) {
      const getEmitter = () => {
        let emitter = servicesEmitters.get(serviceKey)?.deref()
        if (!emitter) {
          emitter = new EventEmitter()
          servicesEmitters.set(serviceKey, new WeakRef(emitter))
        }
        return emitter
      }

      const emitter = getEmitter()
      return {
        key: serviceKey,
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
        async call(method, ...payload) {
          const result = await ipcRenderer.invoke('service-call', serviceKey, method, ...payload)
          return receive(result, states, pendingCommits, gc)
        },
      }
    },
  }
}

export const serviceChannels = createServiceChannels()

contextBridge.exposeInMainWorld('serviceChannels', createServiceChannels())
