import { i18n } from '@/i18n'
import { vuetify } from '@/vuetify'
import { BaseServiceKey } from '@xmcl/runtime-api'
import 'virtual:uno.css'
import { h } from 'vue'
import BrowseVue from './Browse.vue'


const app = createApp({
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
app.use(vuetify)
app.use(i18n)
app.mount('#app')
