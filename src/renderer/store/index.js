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


(() => {
    console.log('start loading modules')
    console.log(store)
    const keys = Object.keys(modules)
    const promises = []
    for (const key of keys) {
        if (modules.hasOwnProperty(key)) {
            const action = `${key}/load`;
            if (store._actions[action]) {
                promises.push(store.dispatch(action).then((instance) => {
                    store.commit(`${key}/$reload`, instance)
                }))
            }
        }
    }
    return Promise.all(promises)
})()

export default store
