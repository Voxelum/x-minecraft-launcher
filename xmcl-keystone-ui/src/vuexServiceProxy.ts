import { computed, reactive, ref, Ref } from '@vue/composition-api'
import { ServiceChannel, ServiceKey, State } from '@xmcl/runtime-api'
import { MutationPayload, Store } from 'vuex'
import { ServiceFactory, StateOfService } from './composables'

export type StateOfServiceKey<K> = K extends ServiceKey<infer Serv>
  ? StateOfService<Serv>
  : never

const TasksContainer = Symbol('TaskContainer')
const ACCESSOR_SYMBOLS = Symbol('Accessor')

export function getServiceCallTasks(promise: Readonly<Promise<any>>): Ref<string[]> {
  return Reflect.get(promise, TasksContainer)
}

function createStoreAccessor(store: Store<any>, symb: VuexModuleTemplateSymbols, proxy: ServiceChannel<any>) {
  const accessor: any = {}
  Object.defineProperty(accessor, ACCESSOR_SYMBOLS, { value: symb })
  for (const [key] of symb.state) {
    accessor[key] = computed(() => (store as any).state[`services/${symb.name}`][key])
  }
  for (const [key] of symb.getters) {
    accessor[key] = computed(() => store.getters[key])
  }
  for (const [key] of symb.mutations) {
    accessor[key] = (payload: any) => {
      proxy.commit(key, payload)
    }
  }
  return accessor
}

interface VuexModuleTemplateSymbols {
  name: string
  state: [string, any][]
  getters: [string, () => any][]
  mutations: [string, (payload: any) => void][]
  accessor: [string, any][]
}

function createGetterAccessor(symb: VuexModuleTemplateSymbols, state: any, getters: any, rootState: any, rootGetters: any, external: boolean) {
  const accessor = {} as any
  if (!external) {
    for (const [key] of symb.state) {
      Object.defineProperty(accessor, key, { get() { return state[key] } })
    }
    for (const [key] of symb.getters) {
      Object.defineProperty(accessor, key, { get() { return getters[key] } })
    }
  } else {
    for (const [key] of symb.state) {
      Object.defineProperty(accessor, key, { get() { return rootState[`services/${symb.name}`][key] } })
    }
    for (const [key] of symb.getters) {
      Object.defineProperty(accessor, key, { get() { return rootGetters[key] } })
    }
  }
  for (const [key, acc] of symb.accessor) {
    accessor[key] = createGetterAccessor(acc[ACCESSOR_SYMBOLS], state, getters, rootState, rootGetters, true)
  }
  return accessor
}

function createStoreTemplate(symb: VuexModuleTemplateSymbols) {
  const state = {
    syncing: false,
  } as any
  const mutations = {
    syncStart(state: any, payload: any) {
      if (payload.service === symb.name) {
        state.syncing = true
      }
    },
    sync(state: any, payload: any) {
      if (payload[symb.name]) {
        for (const [k, v] of Object.entries(payload[symb.name])) {
          state[k] = v
        }
      }
      state.syncing = false
    },
  } as any
  const getters = {} as any
  for (const [key, val] of symb.state) {
    state[key] = val
  }
  for (const [key, get] of symb.getters) {
    getters[key] = (state: any, getters: any, rootState: any, rootGetters: any) => get.call(createGetterAccessor(symb, state, getters, rootState, rootGetters, false))
  }
  for (const [key, mut] of symb.mutations) {
    mutations[key] = (state: any, payload: any) => mut.call(state, payload)
  }

  return {
    state,
    getters,
    mutations,
  }
}

function getStoreTemplateSymbol(name: string, stateTemplate: State<any>) {
  function extractSymbol(o: object, s: VuexModuleTemplateSymbols) {
    let descriptors = Object.getOwnPropertyDescriptors(o)
    if (name === 'UserService') {
      descriptors = Object.assign({}, Object.getOwnPropertyDescriptors(Object.getPrototypeOf(o)), descriptors)
    }
    for (const [key, prop] of Object.entries(descriptors)) {
      if (typeof prop.value !== 'undefined') {
        const val = prop.value
        if (val instanceof Function) {
          if (key !== 'constructor') {
            // mutation
            s.mutations.push([key, val])
          }
        } else {
          if (val && (val[ACCESSOR_SYMBOLS])) {
            s.accessor.push([key, val])
          } else {
            // state
            s.state.push([key, val])
          }
        }
      } else if (prop.get) {
        // getters
        s.getters.push([key, prop.get])
      }
    }
  }

  const symb: VuexModuleTemplateSymbols = {
    name,
    state: [],
    getters: [],
    mutations: [],
    accessor: [],
  }
  extractSymbol(stateTemplate, symb)
  extractSymbol(Object.getPrototypeOf(stateTemplate), symb)

  return symb
}

/**
 * The service factory to backed by vuex to store state
 */
export class VuexServiceFactory implements ServiceFactory {
  private cache: Record<string, any | undefined> = {}

  constructor(readonly store: Store<any>) { }

  /**
   * Create reactive state backed by vuex
   */
  private createReactiveState<T>(service: ServiceKey<T>, state: any, proxy: ServiceChannel<any>) {
    const symbols = getStoreTemplateSymbol(service.toString(), state)
    const accessor = createStoreAccessor(this.store, symbols, proxy)
    const template = createStoreTemplate(symbols)
    this.store.registerModule(`services/${service.toString()}`, template)
    return reactive(accessor)
  }

  private createSync(proxy: ServiceChannel<any>, service: string) {
    let lastId = 0
    let syncingQueue: { [id: string]: MutationPayload } = {}

    proxy.on('commit', ({ mutation, id }) => {
      if (this.store.state[`services/${service}`].syncing) {
        syncingQueue[id] = mutation
        return
      }
      const newId = lastId + 1
      if (id !== newId) {
        console.log(`Sync conflict from main. Last id in renderer: ${lastId}. Sync from main ${id}`)
        sync()
      } else {
        this.store.commit(mutation.type, mutation.payload)
        lastId = newId
      }
    })
    const sync = () => {
      this.store.commit('syncStart', { service })
      console.log(`Sync ${service}.`)
      proxy.sync(lastId).then((syncInfo) => {
        if (!syncInfo) {
          console.log(`The ${service} is not syncable.`)
          this.store.commit('sync', {})
          return
        }
        const {
          state,
          length,
        } = syncInfo
        console.log(`Synced ${length} commits for ${service}.`)

        this.store.commit('sync', { [service]: state })
        lastId = length

        syncingQueue = {}
      })
    }

    return sync
  }

  private createProxy<T>(serviceKey: ServiceKey<T>, state?: StateOfService<T>) {
    const proxy = serviceChannels.open(serviceKey)
    const reactiveState = state ? this.createReactiveState(serviceKey, state, proxy) : undefined

    const service: Record<string, any> = new Proxy({
    }, {
      get(o, key, r) {
        if (key === 'state') return reactiveState
        if (key === 'on') return proxy.on
        if (key === 'once') return proxy.once
        if (key === 'removeListener') return proxy.removeListener
        if (key === 'sync') return proxy.sync
        return (payload: any) => proxy.call(key as any, payload)
      },
    })
    const sync = this.createSync(proxy, serviceKey as any)

    proxy.on('task', ({ promise, id }) => {
      const prom = promise as any
      if (!(prom)[TasksContainer]) {
        Object.defineProperty(promise, TasksContainer, { value: ref([]), enumerable: false, writable: false, configurable: false })
      }
      prom[TasksContainer].value.push(id)
    })

    sync()
    return service
  }

  getService<T>(key: ServiceKey<T>): T {
    const cached = this.cache[key.toString()]
    if (!cached) { throw new Error(`Unregister service ${key.toString()}`) }
    return cached
  }

  register<T>(serviceKey: ServiceKey<T>, factory: () => StateOfService<T>): void {
    if (this.cache[serviceKey.toString()]) {
      throw new Error(`Duplicated registered ${serviceKey}`)
    }
    const proxy = this.createProxy(serviceKey, factory())
    this.cache[serviceKey.toString()] = proxy
  }
}
