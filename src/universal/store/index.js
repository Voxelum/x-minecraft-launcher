
import Vue from 'vue'
import Vuex from 'vuex'

import plugins from './plugins'
import state from './state'
import modules from './modules'
import getters from './getters'

Vue.use(Vuex);

export default {
    state,
    mutations: {
        root: (st, r) => { st.root = r },
    },
    modules,
    getters,
    strict: process.env.NODE_ENV !== 'production',
    plugins,
}
