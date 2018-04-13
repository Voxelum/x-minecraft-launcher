import Vuex from 'vuex';
import { remote, ipcRenderer } from 'electron';

import universalStore from '../../universal/store';
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

ipcRenderer.on('vuex-commit', (event, mutation, id) => {
    const newId = lastId + 1;
    if (id !== newId) {
        ipcRenderer.send('vuex-sync', lastId);
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
});

ipcRenderer.send('vuex-sync', 0);

const remoteCall = remote.require('./main');
localStore.commit = remoteCall.commit;
localStore.dispatch = remoteCall.dispatch;
localStore.localCommit = localCommit;

export default localStore;
