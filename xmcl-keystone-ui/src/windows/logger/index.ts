import VueCompositionApi, { createApp, h } from '@vue/composition-api'
import Vuetify from 'vuetify'
import 'vuetify/dist/vuetify.min.css'
import colors from 'vuetify/es5/util/colors'
import Logger from './Logger.vue'
import '/@/assets/google.font.css'
import Vue from 'vue'

Vue.use(VueCompositionApi)
const app = createApp({
  setup() {
    return () => h(Logger)
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
