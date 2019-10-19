/* eslint-disable guard-for-in */
import Task from '@xmcl/task';
import { app, ipcMain, shell } from 'electron';
import { platform } from 'os';
import { join } from 'path';
import { BaseState } from 'universal/store';
import { v4 } from 'uuid';
import Vue from 'vue';
import Vuex, { ActionContext, Module as VModule, Store, StoreOptions, DispatchOptions } from 'vuex';
import modules from './modules';
import plugins from './plugins';
import { child, update, add, status } from '../taskManager';
import { TaskState } from 'universal/store/modules/task';

Vue.use(Vuex);

let isLoading = false;
let store: Store<BaseState> | null = null;

function wrapStoreActionAsTask(store: VModule<any, any>) {
    if (!store.actions) return;
    const newActions: Required<VModule<any, any>>['actions'] = {};
    for (const [name, func] of Object.entries(store.actions)) {
        newActions[name] = async function (context, payload) {
            let parent: TaskState | undefined;
            let realPayload;
            if (payload && payload.__parent__) {
                parent = payload.parent;
                realPayload = payload.payload;
            } else {
                parent = undefined;
                realPayload = payload;
            }

            const node: TaskState = {
                _internalId: v4(),
                time: new Date().toString(),
                name,
                total: -1,
                progress: -1,
                path: parent ? `${parent.path}.${name}` : name,
                children: [],
                error: null,
                message: '',
                status: 'running',
            };

            if (parent) {
                child(node._internalId, node);
            } else {
                add(node._internalId, node);
            }

            const wrappedContext: ActionContext<any, any> & { update: Task.Context['update'] } = {
                ...context,
                update: function (progress, total, message) {
                    update(node._internalId, { progress, total, message });
                },
                dispatch: async function (type: string, payload?: any, option?: DispatchOptions & { foreground?: boolean }) {
                    const newPayload = { payload };
                    Object.defineProperties(newPayload, { __parent__: { value: node } });
                    return context.dispatch(type, newPayload);
                },
            };

            try {
                const reuslt = await (func as any)(wrappedContext, realPayload);
                status(node._internalId, 'successed');
                return reuslt;
            } catch (e) {
                status(node._internalId, 'failed');
                throw e;
            }
        }
    }
    store.actions = newActions;
}

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
        // wrapStoreActionAsTask(copy)
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
                setTimeout(() => {
                    app.quit();
                }, 150);
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

    setupStore(newStore, root);

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

    console.log('Done loading store!');

    // Force sync the root
    store = newStore;
    ipcMain.emit('store-ready', newStore);
}

ipcMain.on('reload', load);

function setupStore(store: Store<BaseState>, root: string) {
    store.commit('root', root);
    store.commit('platform', platform());
    store.commit('locale', app.getLocale());
}

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
