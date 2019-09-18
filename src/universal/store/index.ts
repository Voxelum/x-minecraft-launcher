
import Vue from 'vue';
import Vuex from 'vuex';
import { Module, BaseActions, BaseGetters, BaseMutations, BaseState } from "./store";
import { StoreOptions } from 'vuex';
import modules from './modules';

Vue.use(Vuex);

export interface RootModule extends Module<'', BaseState, BaseGetters, BaseMutations, BaseActions> {
    modules: any
    strict: boolean
}

export default {
    state: {
        root: '',
        online: false,
        platform: 'win32',
    },
    modules,
    mutations: {
        online(state, o) { state.online = o; },
        root(state, r) { state.root = r; },
        platform(state, p) { state.platform = p; },
    },
    getters: {},
    strict: process.env.NODE_ENV !== 'production',
} as StoreOptions<BaseState>;
