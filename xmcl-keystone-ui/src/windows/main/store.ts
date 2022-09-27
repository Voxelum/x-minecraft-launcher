import Vuex, { Store } from 'vuex'

/**
 * Provide vuex store for certain modules.
 */
export function createStore(): Store<any> {
  const options = {
    state: {
      loading: false,
    },
    modules: {
    },
    mutations: {
      syncStart(state: any, service: string) { },
    },
  }
  const store = new Vuex.Store(options)
  return store
}
