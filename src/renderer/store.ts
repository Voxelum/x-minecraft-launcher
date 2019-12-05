import { ipcRenderer } from 'electron';
import storeOption from 'universal/store';
import Vuex, { MutationPayload } from 'vuex';

export default function createStore(option: string[]) {
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

    function sync() {
        syncing = true;
        ipcRenderer.invoke('sync', lastId).then(({
            mutations,
            length,
        }) => {
            console.log(`sync ${length}`);
            mutations.forEach(localCommit);
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

    // localStore.dispatch = remoteCall.dispatch;
    localStore.commit = (type: string, payload: any) => {
        ipcRenderer.invoke('commit', type, payload);
    };
    localStore.localCommit = localCommit;

    return localStore;
}
