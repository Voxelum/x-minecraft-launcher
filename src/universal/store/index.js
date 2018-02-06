
import Vue from 'vue'
import Vuex from 'vuex'

import plugins from './plugins'
import state from './state'
import modules from './modules'
import getters from './getters'

Vue.use(Vuex);

export default {
    state,
    modules,
    getters,
    strict: process.env.NODE_ENV !== 'production',
    plugins,
}

// export default (root, themes, theme) => {
//     state.root = root;
//     state.themes = themes || ['semantic'];
//     state.theme = theme || 'semantic'
//     const store = new Vuex.Store({
//         state,
//         mutations,
//         modules,
//         getters,
//         actions,
//         strict: process.env.NODE_ENV !== 'production',
//         plugins,
//     });

    // return Promise.all(Object.keys(modules).map((key) => {
    //     const action = `${key}/load`;
    //     if (store._actions[action]) {
    //         console.log(`Found loading action [${action}]`)
    //         return store.dispatch(action).then((instance) => {
    //             const id = key;
    //             store.commit(`${id}/$reload`, instance)
    //             console.log(`Loaded module [${id}]`)
    //         }, (err) => {
    //             const id = key
    //             console.error(`An error occured when we load module [${id}].`)
    //             console.error(err)
    //         })
    //     }
    //     return Promise.resolve();
    // })).then(() => {
    //     console.log('Done loading store!')
    //     return store
    // }, (err) => {
    //     console.log('Done loading store with Error')
    //     console.log(err)
    //     return store
    // })
// }
