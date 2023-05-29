import { State } from '@xmcl/runtime-api'
import { Store } from 'vuex'

const ACCESSOR_SYMBOLS = Symbol('Accessor')

export function createStoreAccessor(store: Store<any>, symb: VuexModuleTemplateSymbols, commit: (key: string, payload: any) => void) {
  const accessor: any = {}
  Object.defineProperty(accessor, ACCESSOR_SYMBOLS, { value: symb })
  for (const [key] of symb.state) {
    accessor[key] = computed(() => (store as any).state[`services/${symb.name}`][key])
  }
  for (const [key] of symb.getters) {
    accessor[key] = computed(() => store.getters[key])
  }
  for (const [key] of symb.mutations) {
    accessor[key] = (payload: any) => commit(key, payload)
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

export function createStoreTemplate(symb: VuexModuleTemplateSymbols) {
  const state = {
    syncing: false,
  } as any
  const mutations = {
    // TODO: remove this
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
    namespaced: true,
    state,
    getters,
    mutations,
  }
}

export function getStoreTemplateSymbol(name: string, stateTemplate: State<any>) {
  function extractSymbol(o: object, s: VuexModuleTemplateSymbols) {
    let descriptors = Object.getOwnPropertyDescriptors(o)
    for (let prototype = Object.getPrototypeOf(o); prototype.constructor !== Object; prototype = Object.getPrototypeOf(prototype)) {
      descriptors = Object.assign({}, Object.getOwnPropertyDescriptors(prototype), descriptors)
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
      } else {
        s.state.push([key, undefined])
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

  return symb
}
