
import { RendererInterface } from 'electron';
import Vue from 'vue';
import Vuex, { StoreOptions } from 'vuex';
import modules from './modules';
import { BaseState, Store, RootCommit } from './root';

Vue.use(Vuex);
export interface SaveAction {
    save: (payload: { mutation: keyof RootCommit, payload: any }) => void;
}
export interface LoadAction {
    load: () => void;
}
export interface InitAction {
    init: () => void;
}
export interface SaveLoadAction extends SaveAction, LoadAction {
}

export default {
    state: {
        root: '',
        online: false,
        platform: 'win32',
    },
    mutations: {
        online(state, o) { state.online = o; },
        root(state, r) { state.root = r; },
        platform(state, p) { state.platform = p; },
    },
    getters: {},
    modules,
    strict: process.env.NODE_ENV !== 'production',
} as StoreOptions<BaseState>;


declare module "vue/types/vue" {
    interface Vue {
        $repo: Store;
        $electron: RendererInterface;
    }
}

export * from './root';
