import Vue from 'vue'
import Vuex from 'vuex'

import plugins from './plugins'
import modules from './modules'

Vue.use(Vuex)

export default new Vuex.Store({
    modules,
    strict: process.env.NODE_ENV !== 'production',
    plugins,
})
