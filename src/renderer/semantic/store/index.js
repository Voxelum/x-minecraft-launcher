import Vuex from 'vuex';
import { remote, ipcRenderer } from 'electron';

import universalStore from 'universal/store';
import modules from './modules';

const store = {
    ...universalStore,
};
store.modules = {
    ...store.modules,
    ...modules,
};

const localStore = new Vuex.Store(store);
const localCommit = localStore.commit;
let lastId = 0;
let syncing = true;
const syncingQueue = {};

ipcRenderer.on('vuex-commit', (event, mutation, id) => {
    if (syncing) {
        syncingQueue[id] = mutation;
        return;
    }
    const newId = lastId + 1;
    if (id !== newId) {
        ipcRenderer.send('vuex-sync', lastId);
        syncing = true;
    } else {
        localCommit(mutation.type, mutation.payload);
        lastId = newId;
    }
});
ipcRenderer.on('vuex-sync', (event, mutations, id) => {
    for (const mul of mutations) {
        localCommit(mul.type, mul.payload)
    }
    lastId = id;
    syncing = false;
    const missing = Object.keys(syncingQueue)
        .map(k => Number.parseInt(k, 10))
        .filter(i => i > lastId);
    if (missing.length !== 0) {
        for (const key of missing) {
            console.log(syncingQueue[key])
        }
    }
});
ipcRenderer.on('vuex-register-module', (event, path, module) => {
    localStore.registerModule(path, module);
})
ipcRenderer.on('vuex-unregister-module', (event, path) => {
    localStore.unregisterModule(path);
})

ipcRenderer.send('vuex-sync', 0);

const remoteCall = remote.require('./main');
localStore.commit = remoteCall.commit;
localStore.dispatch = remoteCall.dispatch;
localStore.localCommit = localCommit;

export default localStore;
