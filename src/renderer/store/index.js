import Vuex from 'vuex';
import { remote, ipcRenderer } from 'electron';
import crypto from 'crypto'

import universalStore from '../../universal/store';
import modules from './modules';

const main = remote.require('./main').default;

const hasher = crypto.createHash();

const mainStore = main.store

const store = {
    ...universalStore,
};

store.modules = {
    ...store.modules,
    ...modules,
}

const localStore = new Vuex.Store(store);
const localCommit = localStore.commit;
let lastHash = '';

mainStore.history.forEach((h) => {
    hasher.update(lastHash);
    hasher.update(h.toString());
    lastHash = hasher.digest('hex');
    localCommit(h)
})

ipcRenderer.on('vuex-commit', (event, mutation, hash) => {
    hasher.update(lastHash);
    hasher.update(mutation.toString());
    lastHash = hasher.digest('hex');
    if (hash !== lastHash) {
        console.error('Signiture not match!');
        localCommit(mutation);
        // ipcRenderer.send('vuex-sync');
        // ipcRenderer.once('vuex-sync', () => {

        // })
    } else {
        localCommit(mutation);
    }
})

localStore.commit = mainStore.commit;
localStore.dispatch = mainStore.dispatch;

export default localStore;

// export default {
//     ...universalStore
//     state.root = root;
//     const store = new Vuex.Store({
//         state,
//         mutations,
//         modules,
//         getters,
//         actions,
//         strict: process.env.NODE_ENV !== 'production',
//         plugins,
//     });

//     return Promise.all(Object.keys(modules).map((key) => {
//         const action = `${key}/load`;
//         if (store._actions[action]) {
//             console.log(`Found loading action [${action}]`)
//             return store.dispatch(action).then((instance) => {
//                 const id = key;
//                 store.commit(`${id}/$reload`, instance)
//                 console.log(`Loaded module [${id}]`)
//             }, (err) => {
//                 const id = key
//                 console.error(`An error occured when we load module [${id}].`)
//                 console.error(err)
//             })
//         }
//         return Promise.resolve();
//     })).then(() => {
//         console.log('Done loading store!')
//         return store
//     }, (err) => {
//         console.log('Done loading store with Error')
//         console.log(err)
//         return store
//     })
// }
