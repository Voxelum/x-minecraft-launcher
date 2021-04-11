import { GetterTree, ModuleTree, MutationTree, StoreOptions, MutationPayload } from 'vuex'
import { Logger } from '../managers/LogManager'

type Container = {
  state?: any
  getters?: GetterTree<any, any>
  mutations?: MutationTree<any>
  modules?: ModuleTree<any>
}

function createGetters(rootState: any, rootGetters: GetterTree<any, any>, getters: GetterTree<any, any>, state: any, container: Container) {
  if (container.getters) {
    for (const [key, func] of Object.entries(container.getters)) {
      Object.defineProperty(getters, key, {
        get() { return func(state, getters, rootState, rootGetters) },
        enumerable: true,
      })
      Object.defineProperty(rootGetters, key, {
        get() { return func(state, getters, rootState, rootGetters) },
        enumerable: true,
      })
    }
  }
}
function createMutations(state: any, mutations: Record<string, (payload?: any) => any>, container: Container) {
  if (container.mutations) {
    for (const [key, func] of Object.entries(container.mutations)) {
      mutations[key] = (payload) => func(state, payload)
    }
  }
}
function deepCopy<T>(object: T): T {
  return JSON.parse(JSON.stringify(object))
}

type Listener = (mutation: MutationPayload, state: any) => void

export interface StaticStore<T> {
  state: T
  getters: Record<string, any>
  commit: (name: string, payload?: any) => void
  subscribe: (fn: Listener) => void
}

export function createStaticStore<T>(template: StoreOptions<T>, logger: Logger): StaticStore<T> {
  const subscriptions: Listener[] = []

  const state = deepCopy(typeof template.state === 'object' ? template.state : (template as any).state())
  const getters: GetterTree<any, any> = {}
  const mutations: Record<string, (payload?: any) => any> = {}
  const subscribe: (fn: Listener) => void = (fn) => {
    subscriptions.push(fn)
  }

  function discover(thisState: any, container: Container) {
    createGetters(state, getters, {}, thisState, container)
    createMutations(thisState, mutations, container)
    if (container.modules) {
      for (const [key, value] of Object.entries(container.modules)) {
        thisState[key] = discover(deepCopy(value.state), value)
      }
    }
    return thisState
  }
  discover(state, template)

  const commit = (type: string, payload: any) => {
    if (mutations[type]) {
      mutations[type](payload)
      subscriptions.forEach((f) => f({ type, payload }, state))
    } else {
      logger.warn(`[StaticStore] Cannot find mutation ${type}`)
    }
  }

  return {
    state: state as T,
    getters,
    commit,
    subscribe,
  }
}
