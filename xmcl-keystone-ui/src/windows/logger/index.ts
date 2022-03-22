import VueCompositionApi, { createApp, h } from '@vue/composition-api'
import Logger from './Logger.vue'
import vuetify from './vuetify'
import Vue from 'vue'
import 'virtual:windi.css'

Vue.use(VueCompositionApi)
const app = createApp({
  vuetify,
  setup() {
    return () => h(Logger)
  },
})
app.mount('#app')
