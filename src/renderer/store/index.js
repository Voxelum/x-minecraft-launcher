import Vue from 'vue'
import Vuex from 'vuex'

import plugins from './plugins'
import state from './state'
import mutations from './mutations'
import modules from './modules'
import getters from './getters'
import actions from './actions'
import loadable from './loadable'

Vue.use(Vuex)

Object.keys(modules).forEach(key => loadable(modules[key]))

export default (root, themes, theme) => {
    state.root = root;
    state.themes = themes || ['semantic', 'material'];
    state.theme = theme || 'semantic'
    const store = new Vuex.Store({
        state,
        mutations,
        modules,
        getters,
        actions,
        strict: process.env.NODE_ENV !== 'production',
        plugins,
    });

    return Promise.all(Object.keys(modules).map((key) => {
        const action = `${key}/load`;
        if (store._actions[action]) {
            console.log(`Found action ${action}`)
            return store.dispatch(action).then((instance) => {
                const id = key;
                store.commit(`${id}/$reload`, instance)
                console.log(`loaded module [${id}]`)
            }, (err) => {
                const id = key
                console.error(`an error occured when we load module [${id}].`)
                console.error(err)
            })
        }
        return Promise.resolve();
    })).then(() => {
        console.log('Done loading store!')
        return store
    }, (err) => {
        console.log('Done loading store with Error')
        return store
    })
}
