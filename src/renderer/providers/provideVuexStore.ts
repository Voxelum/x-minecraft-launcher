import Vue from 'vue';
import Vuex, { MutationPayload } from 'vuex';
import storeOption from 'universal/store';
import { ipcRenderer } from '../constant';

export default function provideVuexStore(...option: string[]) {
    storeOption.modules = {
        ...storeOption.modules,
    };
    storeOption.plugins = [
        ...(storeOption.plugins || []),
    ];
    storeOption.mutations!.sync = (state, payload) => {
        const keys = Object.keys(payload);
        for (const k of keys) {
            if (k in state) {
                (state as any)[k] = payload[k];
            } else {
                Vue.set(state, k, payload[k]);
            }
        }
    };

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

    function sync() {
        syncing = true;

        ipcRenderer.invoke('sync', lastId).then((syncInfo) => {
            if (!syncInfo) return;
            const {
                state,
                length,
            } = syncInfo;
            console.log(`Synced ${length} commits.`);
            _commit('sync', state);
            // mutations.forEach(localCommit);
            lastId = length;
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
            ipcRenderer.emit('synced');
        });
    }

    ipcRenderer.on('commit', (event, mutation, id) => {
        if (syncing) {
            syncingQueue[id] = mutation;
            return;
        }
        const newId = lastId + 1;
        if (id !== newId) {
            sync();
        } else {
            localCommit(mutation);
            lastId = newId;
        }
    });
    sync();

    localStore.commit = (type: string, payload: any) => {
        ipcRenderer.invoke('commit', type, payload);
    };

    return localStore;
}
