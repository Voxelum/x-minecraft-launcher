import Vuex, { MutationPayload } from 'vuex';
import { remote, ipcRenderer } from 'electron';

import storeOption from 'universal/store';

export default function (option: string[]) {
    storeOption.modules = {
        ...storeOption.modules,
    };
    storeOption.plugins = [
        ...(storeOption.plugins || []),
    ];

    const localStore: any = new Vuex.Store(storeOption);
    const _commit = localStore.commit;
    const localCommit = (mutation: MutationPayload) => {
        if (localStore._mutations[mutation.type]) {
            _commit(mutation.type, mutation.payload);
        } else {
            console.log(`discard commit ${mutation.type}`);
        }
    };

    let lastId = 0;
    let syncing = true;
    let syncingQueue: { [id: string]: MutationPayload } = {};

    ipcRenderer.on('vuex-commit', (event: any, mutation: MutationPayload, id: number) => {
        if (syncing) {
            syncingQueue[id] = mutation;
            return;
        }
        const newId = lastId + 1;
        if (id !== newId) {
            ipcRenderer.send('vuex-sync', lastId);
            syncing = true;
        } else {
            localCommit(mutation);
            lastId = newId;
        }
    });
    ipcRenderer.on('vuex-sync', (event: any, mutations: MutationPayload[], id: number) => {
        mutations.forEach(localCommit);
        lastId = id;
        syncing = false;

        const missing = Object.keys(syncingQueue)
            .map(k => Number.parseInt(k, 10))
            .filter(i => i > lastId);
        if (missing.length !== 0) {
            for (const key of missing) {
                console.log(syncingQueue[key]);
            }
        }
        syncingQueue = {};
    });
    ipcRenderer.send('vuex-sync', 0);

    const remoteCall = remote.require('./main');

    let actionSeq = 0;
    function dispatchProxy(action: string, payload: any, option: any) {
        const id = actionSeq++;
        ipcRenderer.send('vuex-dispatch', { action, payload, option, id });
        return new Promise((resolve, reject) => {
            ipcRenderer.once(`vuex-dispatch-${id}`, (event: any, { error, result }: { error: any; result: any }) => {
                if (error) reject(error);
                else resolve(result);
            });
        });
    }

    function dummy() { }
    function createMutationProxy(path: string[]) {
        return new Proxy(dummy, {
            get(target: any, key: string) {
                if (!target[key]) target[key] = createMutationProxy([...path, key]);
                return target[key];
            },
            apply(target, thisArg, args) {
                return remoteCall.commit([...path, args[0]].join('/'), args[1], args[2]);
            },
        });
    }
    function createDispatchProxy(path: string[]) {
        return new Proxy(dummy, {
            get(target: any, key: string) {
                if (!target[key]) target[key] = createDispatchProxy([...path, key]);
                return target[key];
            },
            apply(target, thisArg, args) {
                return remoteCall.dispatch([...path, args[0]].join('/'), args[1], args[2]);
            },
        });
    }
    function createGettersProxy(path: string[]) {
        return new Proxy({}, {
            get(target: any, key: string) {
                const realKey = [...path, key].join('/');
                if (realKey in localStore.getters) {
                    return localStore.getters[realKey];
                }
                if (!target[key]) {
                    target[key] = createDispatchProxy([...path, key]);
                }
                return target[key];
            },
        });
    }

    localStore.dispatches = createDispatchProxy([]);
    localStore.get = createGettersProxy([]);
    localStore.commits = createMutationProxy([]);

    // localStore.dispatch = dispatchProxy;
    localStore.dispatch = remoteCall.dispatch;
    localStore.commit = remoteCall.commit;
    localStore.localCommit = localCommit;

    return localStore;
}
