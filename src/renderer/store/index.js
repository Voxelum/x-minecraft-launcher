import Vue from 'vue'
import Vuex from 'vuex'

import plugins from './plugins'
import modules from './modules'
import actions from './actions'
import loadable from './loadable'

Vue.use(Vuex)

for (const key in modules) {
    if (modules.hasOwnProperty(key)) {
        loadable(modules[key])
    }
}

const store = new Vuex.Store({
    modules,
    actions,
    strict: process.env.NODE_ENV !== 'production',
    plugins,
});

<<<<<<< HEAD

(() => {
=======
export const init = () => {
>>>>>>> 2cb24596ff40ff78025f0194067407fc3b5b61d5
    console.log('start loading modules')
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
    })
}


export default init
