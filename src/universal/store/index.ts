
import { RendererInterface } from 'electron';
import Vue from 'vue';
import Vuex, { StoreOptions } from 'vuex';
import modules from './modules';
import { BaseState, Store } from './root';

Vue.use(Vuex);

export default {
    state: {
        root: '',
        online: false,
        platform: 'win32',
        semaphore: {},
    },
    mutations: {
        online(state, o) { state.online = o; },
        root(state, r) { state.root = r; },
        platform(state, p) { state.platform = p; },
        aquire(state, res) {
            const sem = res instanceof Array ? res : [res];
            for (const s of sem) {
                if (s in state) { state.semaphore[s] += 1; }
                else { Vue.set(state.semaphore, s, 1); }
            }
        },
        release(state, res) {
            const sem = res instanceof Array ? res : [res];
            for (const s of sem) {
                if (s in state) { state.semaphore[s] -= 1; }
            }
        }
    },
    getters: {
        released(state) { return (key: string) => state.semaphore[key] === 0; }
    },
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

