import Vue from 'vue'
import Vuex from 'vuex'

import plugins from './plugins'
import modules from './modules'
import loadable from './loadable'

Vue.use(Vuex)

for (const key in modules) {
    if (modules.hasOwnProperty(key)) {
        loadable(modules[key])
    }
}

console.log(modules)

export default new Vuex.Store({
    modules,
    strict: process.env.NODE_ENV !== 'production',
    plugins,
})
