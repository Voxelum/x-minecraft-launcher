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
      setLoading(state: any, isLoading: boolean) {

      },
    },
  }
  const store = new Vuex.Store(options)
  return store
}
