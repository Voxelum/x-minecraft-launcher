import { computed, provide, reactive, ref, Ref, set } from '@vue/composition-api'
import { Store } from 'vuex'
import { createServiceFactory } from '../service'
import { ipcRenderer, ServiceProxy, SERVICES_KEY, SERVICES_SEMAPHORE_KEY } from '/@/constant'
import { State } from '/@shared/services/Service'

const TasksContainer = Symbol('TaskContainer')

export function getServiceCallTasks(promise: Readonly<Promise<any>>): Ref<string[]> {
  return Reflect.get(promise, TasksContainer)
}

export function createModule(stateTemplate: State) {
  const state = {} as any
  const mutations = {} as any
  const getters = {} as any

  for (const [key, prop] of Object.entries(Object.getOwnPropertyDescriptors(Object.getPrototypeOf(stateTemplate)))) {
    if (prop.value) {
      const val = prop.value
      if (val instanceof Function) {
        // mutation
        const mut = (state: any, payload: any) => (val as Function).call(state, payload)
        mutations[key] = mut
      } else {
        // state
        state[key] = val
      }
    } else if (prop.get) {
      // getters
      const getter = prop.get
      getters[key] = (state: any) => getter.call(state)
    }
  }
  for (const [key, prop] of Object.entries(Object.getOwnPropertyDescriptors(stateTemplate))) {
    if (prop.value) {
      const val = prop.value
      if (val instanceof Function) {
        // mutation
        const mut = (state: any, payload: any) => (val as Function).call(state, payload)
        mutations[key] = mut
      } else {
        // state
        state[key] = val
      }
    } else if (prop.get) {
      // getters
      const getter = prop.get
      getters[key] = (state: any) => getter.call(state)
    }
  }
  return {
    state,
    getters,
    mutations,
  }
}

function createAccessor<T extends State>(name: string, store: Store<any>, stateTemplate: T): T {
  const accessor = {} as any
  for (const [key, prop] of Object.entries(Object.getOwnPropertyDescriptors(Object.getPrototypeOf(stateTemplate)))) {
    if (prop.value) {
      const val = prop.value
      if (val instanceof Function) {
        // mutation
        accessor[key] = (payload: any) => {
          store.commit(key, payload)
        }
      } else {
        // state
        accessor[key] = computed(() => (store as any).state[name][key])
      }
    } else if (prop.get) {
      // getters
      accessor[key] = computed(() => store.getters[key])
    }
  }
  for (const [key, prop] of Object.entries(Object.getOwnPropertyDescriptors(stateTemplate))) {
    if (prop.value) {
      const val = prop.value
      if (val instanceof Function) {
        // mutation
        accessor[key] = (payload: any) => {
          store.commit(key, payload)
        }
      } else {
        // state
        accessor[key] = computed(() => (store as any).state[name][key])
      }
    } else if (prop.get) {
      // getters
      accessor[key] = computed(() => store.getters[key])
    }
  }
  return reactive(accessor)
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
  const factory = createServiceFactory(
    (service, state) => {
      store.registerModule(service.toString(), createModule(state))
      return createAccessor(service.toString(), store, state)
    },
    (_, __, p: any, ___, id) => {
      if (!(p)[TasksContainer]) {
        Object.defineProperty(p, TasksContainer, { value: ref([]), enumerable: false, writable: false, configurable: false })
      }
      p[TasksContainer].value.push(id)
    })
  const proxy: ServiceProxy = (key) => factory.getService(key)
  provide(SERVICES_KEY, proxy)
  return proxy
}
