import { InjectionKey } from 'vue'
import Vuex, { Store } from 'vuex'

export const kStore: InjectionKey<Store<any>> = Symbol('Store')
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
    strict: import.meta.env.DEV,
  }
  const store = new Vuex.Store(options)
  return store
}
