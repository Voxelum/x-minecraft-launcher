import VueCompositionApi, { h } from '@vue/composition-api'

import colors from 'vuetify/es5/util/colors'
// import 'vuetify/dist/vuetify.css';
import '/@/assets/google.font.css'

import Vue from 'vue'

import 'vuetify/dist/vuetify.min.css'
import Vuetify from 'vuetify'
import provideElectron from '/@/providers/provideElectron'
import Logger from './Logger.vue'

Vue.config.productionTip = false

Vue.use(VueCompositionApi)
Vue.use(Vuetify, {
  theme: {
    primary: colors.green,
    // secondary: colors.green,
    accent: colors.green.accent3,
  },
})

const vue = new Vue({
  setup () {
    provideElectron()
    return () => h(Logger)
  },
})

vue.$mount('#app')
