import Vue from 'vue'
import Vuex from 'vuex'
import { ipcRenderer } from 'electron'

import plugins from './plugins'
import modules from './modules'
import getters from './getters'
import actions from './actions'
import loadable from './loadable'

Vue.use(Vuex)

for (const key in modules) {
    if (modules.hasOwnProperty(key)) {
        loadable(modules[key])
    }
}

export const init = (root) => {
    const store = new Vuex.Store({
        state: { root, dragover: false },
        mutations: {
            dragover(states, value) {
                states.dragover = value
            },
        },
        modules,
        getters,
        actions: actions(root),
        strict: process.env.NODE_ENV !== 'production',
        plugins,
    });

    const keys = Object.keys(modules)
    const promises = []
    for (const key of keys) {
        if (modules.hasOwnProperty(key)) {
            const action = `${key}/load`;
            if (store._actions[action]) {
                console.log(`Found action ${action}`)
                promises.push(store.dispatch(action).then((instance) => {
                    const id = key;
                    store.commit(`${id}/$reload`, instance)
                    console.log(`loaded module [${id}]`)
                }, (err) => {
                    const id = key
                    console.error(`an error occured when we load module [${id}].`)
                    console.error(err)
                }))
            }
        }
    }
    return Promise.all(promises).then(() => {
        console.log('done for all promise!')
        return store
    }, (err) => {
        console.log('Done with Error')
        return store
    })
}


export default init
