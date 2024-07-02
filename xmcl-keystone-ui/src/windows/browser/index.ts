import { i18n } from '@/i18n'
import { vuetify } from '@/vuetify'
import 'virtual:uno.css'
import Vue, { h } from 'vue'
import VueI18n from 'vue-i18n'
import BrowseVue from './Browse.vue'
import { BaseServiceKey } from '@xmcl/runtime-api'

Vue.use(VueI18n, { bridge: true })

const app = new Vue({
  vuetify,
  i18n,
  setup() {
    const baseServiceChannel = serviceChannels.open(BaseServiceKey)
    baseServiceChannel.call('getSettings').then(state => state).then(state => {
      i18n.locale = state.locale
      state.subscribe('localeSet', (locale) => {
        i18n.locale = locale
      })
    })
    return () => h(BrowseVue)
  },
})

app.$mount('#app')
