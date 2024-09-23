/* eslint-disable no-dupe-class-members */

import { AllStates, ServiceChannels, ServiceKey, MutableState, StateMetadata } from '@xmcl/runtime-api'
import { contextBridge, ipcRenderer } from 'electron'
import EventEmitter from 'events'

function getPrototypeMetadata(T: { new(): object }, prototype: object, name: string) {
  const methods = Object.getOwnPropertyNames(prototype)
    .map((name) => [name, Object.getOwnPropertyDescriptor(prototype, name)?.value] as const)
    .filter(([, v]) => v instanceof Function)
  return {
    name,
    constructor: () => new T(),
    methods: methods.map(([name, f]) => [name, (f as Function)] as [string, (this: any, ...args: any[]) => any]),
    prototype,
  }
}

const typeToStatePrototype: Record<string, StateMetadata> = AllStates.reduce((obj, cur) => {
  obj[cur.name] = getPrototypeMetadata(cur, cur.prototype, cur.name)
  return obj
}, {} as Record<string, StateMetadata>)

const kEmitter = Symbol('Emitter')

function createMutableState<T extends object>(val: T, id: string): MutableState<T> {
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
    revalidate() {
      ipcRenderer.invoke('revalidate', id)
    },
  }) as any
}

if (process.env.NODE_ENV === 'development') {
  console.log('serivce.ts preload')
}

async function receive(_result: any, states: Record<string, WeakRef<MutableState<any>>>, pendingCommits: Record<string, { type: string; payload: any }[]>, gc: FinalizationRegistry<string>) {
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

    const prototype = typeToStatePrototype[result.__state__]
    if (!prototype) {
      // Wrong version of runtime
      throw new TypeError(`Unknown state object ${result.__state__}!`)
    }

    delete result.__state__
    const state = createMutableState(result, id)

    for (const [method, handler] of prototype.methods) {
      // explictly bind to the state object under electron context isolation
      state[method] = (...args: any[]) => {
        ipcRenderer.invoke('commit', id, method, ...args)
      }
    }

    gc.register(state, state.id)

    states[id] = new WeakRef(state)

    queueMicrotask(() => {
      if (pendingCommits[id]) {
        for (const mutation of pendingCommits[id]) {
          // state[mutation.type]?.(mutation.payload);
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
  const states: Record<string, WeakRef<MutableState<object>>> = {}
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
      // (state as any)[type]?.(payload);
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
