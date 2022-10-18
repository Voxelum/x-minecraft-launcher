import { InjectionKey } from 'vue'
import VueRouter from 'vue-router'
import { Store } from 'vuex'

export const STORE_KEY: InjectionKey<Store<any>> = Symbol('STORE_KEY')
export const ROUTER_KEY: InjectionKey<VueRouter> = Symbol('ROUTER_KEY')

export const SEARCH_TEXT_KEY: InjectionKey<string> = Symbol('SEARCH_TEXT_KEY')
