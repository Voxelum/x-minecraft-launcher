import { Store } from 'vuex'
import { createStoreAccessor, createStoreTemplate, getStoreTemplateSymbol } from './utils'
import { MutableState } from '@xmcl/runtime-api'

export class VuexStateAdapter {
  private states: Record<string, MutableState<any>> = []

  constructor(readonly store: Store<any>) { }

  /**
   * Create reactive state backed by vuex
   */
  register<T extends object>(state: MutableState<T>) {
    const symbols = getStoreTemplateSymbol(state.id, state as any)
    const accessor = createStoreAccessor(this.store, symbols, (k, p) => (state as any)[k](p))
    const template = createStoreTemplate(symbols)
    this.store.registerModule(state.id, template)
    return reactive(accessor)
  }

  getState(key: string) {
    return this.states[key]
  }
}
