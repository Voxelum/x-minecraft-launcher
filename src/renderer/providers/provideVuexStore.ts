import { provide } from '@vue/composition-api'
import Vuex, { Store } from 'vuex'
import { STORE_KEY } from '../constant'

/**
 * Provide vuex store for certain modules.
 */
export default function provideVuexStore(): Store<any> {
  const options = {
    modules: {
    },
    mutations: {
    },
  }
  const store = new Vuex.Store(options)
  provide(STORE_KEY, store)
  return store
}
