import EventEmitter from 'events'
import { AnyError } from '@xmcl/utils'
import { ServiceStateContext } from './ServiceStateManager'
import { Client } from '~/app'
import { SharedState, createPromiseSignal } from '@xmcl/runtime-api'
import { MutableStateImpl, kStateKey } from './stateUtils'

export type ServiceStateFactory<T> = (context: ServiceStateContext) => Promise<[T, () => void] | [T, () => void, () => Promise<void>]>
const kStateContainer = Symbol('StateContainer')
const trackedClients = new WeakMap<Client, { containers: Set<ServiceStateContainer>; onDestroyed: () => void }>()

function trackClient(client: Client, container: ServiceStateContainer) {
  let tracked = trackedClients.get(client)
  if (!tracked) {
    const containers = new Set<ServiceStateContainer>()
    const onDestroyed = () => {
      for (const trackedContainer of containers) trackedContainer.untrack(client)
    }
    tracked = { containers, onDestroyed }
    trackedClients.set(client, tracked)
    client.on('destroyed', onDestroyed)
  }
  tracked.containers.add(container)
}

function untrackClient(client: Client, container: ServiceStateContainer) {
  const tracked = trackedClients.get(client)
  if (!tracked) return
  tracked.containers.delete(container)
  if (tracked.containers.size === 0) {
    client.removeListener('destroyed', tracked.onDestroyed)
    trackedClients.delete(client)
  }
}

/**
 * The util class to hold each service state snapshot
 */
export class ServiceStateContainer<T = any> implements ServiceStateContext {
  static unwrap(v: object) {
    return (v as any)[kStateContainer] as ServiceStateContainer | undefined
  }

  #revalidating: Promise<void> | undefined
  private semaphore = 0
  #clients: [Client, Function][] = []
  #state: SharedState<T> | undefined
  #signal = createPromiseSignal<SharedState<T>>()
  #disposer: () => void = () => { }
  #revalidator?: () => Promise<void>
  #emitter = new EventEmitter()
  #static = false
  #destroyed = false

  constructor(
    readonly id: string,
    readonly unregister: (id: string) => void,
    factoryOrInstance: { factory: ServiceStateFactory<T> } | { instance: T },
  ) {
    const decorate = (state: any) => {
      const emitter = this.#emitter

      Object.assign(state, {
        id,
      })

      for (const [key, prop] of Object.entries(Object.getOwnPropertyDescriptors(Object.getPrototypeOf(state)))) {
        if (key !== 'constructor' && prop.value instanceof Function) {
          // decorate original mutation
          const func = prop.value.bind(state)
          Reflect.set(state as any, key, function (this: any, value: any) {
            func(value)
            emitter.emit(key, value)
            emitter.emit('*', key, value)
          })
        }
      }

      Object.defineProperties(state, {
        [kStateKey]: { value: Object.getPrototypeOf(state).constructor.name, enumerable: true, configurable: true },
        [kStateContainer]: { value: this, enumerable: false, configurable: true },
      })
      const parent = new MutableStateImpl(emitter, this.revalidate.bind(this))
      Object.setPrototypeOf(Object.getPrototypeOf(state), parent)
    }

    if ('factory' in factoryOrInstance) {
      factoryOrInstance.factory(this).then(([state, disposer, revalidator]) => {
        this.#disposer = disposer
        this.#revalidator = revalidator
        decorate(state)
        this.#state = state as any
        this.#signal.resolve(state as any)
      }, (e) => {
        this.#signal.reject(e)
      })
    } else {
      decorate(factoryOrInstance.instance)
      this.#state = factoryOrInstance.instance as any
      this.#signal.resolve(factoryOrInstance.instance as any)
      this.#static = true
    }
  }

  get state() {
    return this.#state
  }

  get promise() {
    return this.#signal.promise
  }

  doAsyncOperation = async <T>(action: Promise<T>): Promise<T> => {
    try {
      this.semaphore += 1
      for (const [c] of this.#clients) {
        if (c.isDestroyed()) {
          this.untrack(c)
          continue
        }
        c.send('state-validating', { id: this.id, semaphore: this.semaphore })
      }
      return await action
    } finally {
      this.semaphore -= 1
      if (this.semaphore === 0) {
        for (const [c] of this.#clients) {
          if (c.isDestroyed()) {
            this.untrack(c)
            continue
          }
          c.send('state-validating', { id: this.id, semaphore: this.semaphore })
        }
      }
    }
  }

  defineAsyncOperation = <T extends (...args: any[]) => Promise<any>>(action: T): T => {
    return (async (...args: any[]) => {
      return await this.doAsyncOperation(action(...args))
    }) as any
  }

  async revalidate() {
    if (this.#revalidating) return this.#revalidating
    if (this.#revalidator) {
      this.#revalidating = this.#revalidator()
      try {
        await this.#revalidating
      } finally {
        this.#revalidating = undefined
      }
    }
  }

  track(client: Client) {
    if (this.#clients.some(([tracked]) => tracked === client)) return
    const handler = (type: any, payload: any) => {
      client.send('commit', this.id, type, payload)
    }
    this.#clients.push([client, handler])
    this.#emitter.on('*', handler)
    trackClient(client, this)
  }

  untrack(client: Client) {
    const index = this.#clients.findIndex(c => c[0] === client)
    if (index === -1) return false
    const deleted = this.#clients.splice(index, 1)
    if (deleted[0]) {
      const [_, handler] = deleted[0]
      this.#emitter.off('*', handler as any)
      untrackClient(client, this)
      if (this.#clients.length === 0 && !this.#static) {
        this.destroy()
        return true
      }
    }
    return false
  }

  destroy() {
    if (this.#destroyed) return
    this.#destroyed = true
    for (const [client, handler] of this.#clients) {
      this.#emitter.off('*', handler as any)
      untrackClient(client, this)
    }
    this.#clients = []
    this.#emitter.removeAllListeners()
    const disposer = this.#disposer
    this.#disposer = () => { }
    this.#state = undefined
    this.#revalidator = undefined
    try {
      disposer()
    } finally {
      this.unregister(this.id)
    }
  }

  async commit(type: string, payload: any) {
    const state = await this.#signal.promise
    if (typeof (state as any)[type] !== 'function') {
      throw new AnyError('StateError', `Cannot find mutation named ${type} in service ${this.id}`)
    } else {
      (state as any)[type](payload)
    }
  }
}
