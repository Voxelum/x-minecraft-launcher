import VueCompositionApi, { createApp, h } from '@vue/composition-api'
import Vue from 'vue'
import BrowseVue from './Browse.vue'
import Vuetify from 'vuetify'
import 'vuetify/dist/vuetify.min.css'
import '/@/assets/google.font.css'
import colors from 'vuetify/es5/util/colors'
import 'virtual:windi.css'

Vue.use(VueCompositionApi)
const app = createApp({
  setup() {
    return () => h(BrowseVue)
  },
})
app.use(Vuetify, {
  theme: {
    primary: colors.green,
    // secondary: colors.green,
    accent: colors.green.accent3,
  },
})
app.mount('#app')
