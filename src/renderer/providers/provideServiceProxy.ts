import { computed, provide, reactive, ref, Ref, set } from '@vue/composition-api'
import { MutationPayload, Store } from 'vuex'
import { createServiceFactory } from '../service'
import { ipcRenderer, ServiceProxy, SERVICES_KEY, SERVICES_SEMAPHORE_KEY } from '/@/constant'
import { State } from '/@shared/services/Service'

const TasksContainer = Symbol('TaskContainer')

export function getServiceCallTasks(promise: Readonly<Promise<any>>): Ref<string[]> {
  return Reflect.get(promise, TasksContainer)
}

const ACESSOR_SYMBOLS = Symbol('Acessor')
class StoreAccessor implements Record<string, any> {
  // eslint-disable-next-line no-undef
  [key: string]: any

  [ACESSOR_SYMBOLS]: AccessorSymbols

  constructor(store: Store<any>, symb: AccessorSymbols) {
    Object.defineProperty(this, ACESSOR_SYMBOLS, { value: symb })
    for (const [key] of symb.state) {
      this[key] = computed(() => (store as any).state[`services/${symb.name}`][key])
    }
    for (const [key] of symb.getters) {
      this[key] = computed(() => store.getters[key])
    }
    for (const [key] of symb.mutations) {
      this[key] = (payload: any) => {
        ipcRenderer.invoke('commit', key, payload)
      }
    }
  }
}

interface AccessorSymbols {
  name: string
  state: [string, any][]
  getters: [string, () => any][]
  mutations: [string, (payload: any) => void][]
  accessor: [string, StoreAccessor][]
}

function createGetterAcessor(symb: AccessorSymbols, state: any, getters: any, rootState: any, rootGetters: any, external: boolean) {
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
    accessor[key] = createGetterAcessor(acc[ACESSOR_SYMBOLS], state, getters, rootState, rootGetters, true)
  }
  return accessor
}

function createStoreTemplate(symb: AccessorSymbols) {
  const state = {} as any
  const mutations = {
    sync(state: any, payload: any) {
      if (payload[symb.name]) {
        for (const [k, v] of Object.entries(payload[symb.name])) {
          state[k] = v
        }
      }
    },
  } as any
  const getters = {} as any
  for (const [key, val] of symb.state) {
    state[key] = val
  }
  for (const [key, get] of symb.getters) {
    getters[key] = (state: any, getters: any, rootState: any, rootGetters: any) => get.call(createGetterAcessor(symb, state, getters, rootState, rootGetters, false))
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

export function getAcessorSymbols(name: string, stateTemplate: State<any>) {
  function extractSymbols(o: object, s: AccessorSymbols) {
    for (const [key, prop] of Object.entries(Object.getOwnPropertyDescriptors(o))) {
      if (typeof prop.value !== 'undefined') {
        const val = prop.value
        if (val instanceof Function) {
          if (key !== 'constructor') {
            // mutation
            s.mutations.push([key, val])
          }
        } else {
          if (val && (val instanceof StoreAccessor || val[ACESSOR_SYMBOLS])) {
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

  const symb: AccessorSymbols = {
    name,
    state: [],
    getters: [],
    mutations: [],
    accessor: [],
  }
  extractSymbols(stateTemplate, symb)
  extractSymbols(Object.getPrototypeOf(stateTemplate), symb)

  return symb
}

function createSyncable(store: Store<any>) {
  let lastId = 0
  let syncing = true
  let syncingQueue: { [id: string]: MutationPayload } = {}

  function sync() {
    syncing = true

    console.log('Request main process to sync')
    ipcRenderer.invoke('sync', lastId).then((syncInfo) => {
      if (!syncInfo) return
      const {
        state,
        length,
      } = syncInfo
      console.log(`Synced ${length} commits.`)

      store.commit('sync', state)
      lastId = length
      syncing = false

      const missing = Object.keys(syncingQueue)
        .map(k => Number.parseInt(k, 10))
        .filter(i => i > lastId)
      if (missing.length !== 0) {
        for (const key of missing) {
          console.log(syncingQueue[key])
        }
      }
      syncingQueue = {}
      ipcRenderer.emit('synced')
    })
  }

  ipcRenderer.on('commit', (event, mutation, id) => {
    if (syncing) {
      syncingQueue[id] = mutation
      return
    }
    const newId = lastId + 1
    if (id !== newId) {
      console.log(`Sync conflict from main. Last id in renderer: ${lastId}. Sync from main ${id}`)
      sync()
    } else {
      store.commit(mutation.type, mutation.payload)
      lastId = newId
    }
  })

  return sync
}

export function provideSemaphore() {
  const semaphore: Record<string, number> = reactive({})
  ipcRenderer.on('aquire', (e, res) => {
    const sem = res instanceof Array ? res : [res]
    for (const s of sem) {
      if (s in semaphore) {
        semaphore[s] += 1
      } else {
        set(semaphore, s, 1)
      }
    }
  })
  ipcRenderer.on('release', (e, res) => {
    const sem = res instanceof Array ? res : [res]
    for (const s of sem) {
      if (s in semaphore) {
        semaphore[s] = Math.max(0, semaphore[s] - 1)
      } else {
        set(semaphore, s, 0)
      }
    }
  })
  provide(SERVICES_SEMAPHORE_KEY, semaphore)
  return semaphore
}

export default function provideServiceProxy(store: Store<any>) {
  const sync = createSyncable(store)
  const factory = createServiceFactory(
    (service, state) => {
      const symbols = getAcessorSymbols(service.toString(), state)
      const accessor = new StoreAccessor(store, symbols)
      const template = createStoreTemplate(symbols)
      store.registerModule(`services/${service.toString()}`, template)
      return reactive(accessor)
    },
    (_, __, p: any, ___, id) => {
      if (!(p)[TasksContainer]) {
        Object.defineProperty(p, TasksContainer, { value: ref([]), enumerable: false, writable: false, configurable: false })
      }
      p[TasksContainer].value.push(id)
    })
  const proxy: ServiceProxy = (key) => factory.getService(key)
  provide(SERVICES_KEY, proxy)
  sync()
  return proxy
}
