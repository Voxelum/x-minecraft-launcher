import { StoreOptions } from 'vuex';
import modules from './modules';
import { BaseState } from './root';

export default {
    state: {
        root: '',
        launcherVersion: '',
        online: false,
        platform: 'win32',
        semaphore: {},
    },
    mutations: {
        online(state, o) { state.online = o; },
        root(state, r) { state.root = r; },
        platform(state, p) { state.platform = p; },
        launcherVersion(state, s) { state.launcherVersion = s; },
    },
    getters: {
    },
    modules,
    strict: process.env.NODE_ENV !== 'production',
} as StoreOptions<BaseState>;

export * from './root';
