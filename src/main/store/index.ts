/* eslint-disable guard-for-in */
import { app, ipcMain, shell } from 'electron';
import { join } from 'path';
import { platform } from 'os';
import Vue from 'vue';
import Vuex, { Store, StoreOptions } from 'vuex';
import modules from './modules';
import plugins from './plugins';
import { BaseState } from 'universal/store/store';

Vue.use(Vuex);

let isLoading = false;
let store: Store<BaseState> | null = null;

/**
 * Load the store from disk
 */
async function load() {
    ipcMain.removeAllListeners('vuex-sync');
    store = null;
    const root = app.getPath('userData');

    function deepCopyStoreTemplate(template: typeof mod) {
        const copy = Object.assign({}, template);
        if (typeof template.state === 'object') {
            copy.state = JSON.parse(JSON.stringify(template.state));
        }
        if (copy.modules) {
            for (const key of Object.keys(copy.modules)) {
                copy.modules[key] = deepCopyStoreTemplate(copy.modules[key]);
            }
        }
        return copy;
    }
    const mod: StoreOptions<BaseState> = {
        state: {
            root,
            platform: platform(),
            online: false,
        },
        plugins,
        modules,
        getters: {
            // @ts-ignore
            path: state => (...paths) => join(state.root, ...paths),
        },
        mutations: {
            platform(state, p) { state.platform = p; },
            online(state, o) { state.online = o; },
            root(state, r) { state.root = r; },
        },
        actions: {
            async quit() {
                app.quit();
            },
            async showItemInFolder(context, item) {
                shell.showItemInFolder(item);
            },
            async openItem(context, item) {
                shell.openItem(item);
            },
        },
        strict: process.env.NODE_ENV !== 'production',
    };
    const template = deepCopyStoreTemplate(mod); // deep copy the template so there is no strange reference

    const newStore = new Vuex.Store(template);

    isLoading = true;

    let startingTime = Date.now();
    try {
        await newStore.dispatch('load');
    } catch (e) {
        console.error(e);
    }
    console.log(`Successfully load modules. Total Time is ${Date.now() - startingTime}ms.`);

    isLoading = false;

    // wait app ready since in the init stage, the module can access network & others
    await new Promise((resolve) => {
        if (app.isReady()) resolve();
        else app.once('ready', () => resolve());
    });

    startingTime = Date.now();
    try {
        await newStore.dispatch('init');
    } catch (e) {
        console.error(e);
    }
    console.log(`Successfully init modules. Total Time is ${Date.now() - startingTime}ms.`);

    newStore.commit('root', root);
    newStore.commit('platform', platform());

    console.log('Done loading store!');

    // Force sync the root
    store = newStore;
    ipcMain.emit('store-ready', newStore);
}

ipcMain.on('reload', load);

export function commit(type: string, payload: any, option: any) {
    if (store === undefined) {
        return;
    }
    ipcMain.emit(`precommit/${type}`, { type, payload, option });
    if (store) {
        store.commit(type, payload, option);
    } else {
        console.error(`Cannot commit ${type} since the store is null.`);
    }
    ipcMain.emit(`postcommit/${type}`, { type, payload, option });
}

export function dispatch(type: string, payload: any, option: any) {
    if (!store) {
        console.error(`Cannot dispatch ${type} since the store is null.`);
        return Promise.reject(new Error(`Cannot dispatch ${type} since the store is null.`));
    }
    try {
        const result = store.dispatch(type, payload, option);
        if (!(result instanceof Promise)) return Promise.resolve(result);
        return result;
    } catch (e) {
        return Promise.reject(e);
    }
}

export function loading() { return isLoading; }
export function getStore() { return store; }
