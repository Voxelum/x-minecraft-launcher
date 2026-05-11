import { i18n } from '@/i18n'
import { vuetify } from '@/vuetify'
import 'virtual:uno.css'
import { createApp, h, provide } from 'vue'
import BrowseVue from './Browse.vue'
import { BaseServiceKey } from '@xmcl/runtime-api'
import { kServiceFactory, useServiceFactory } from '@/composables'

const app = createApp({
  setup() {
    provide(kServiceFactory, useServiceFactory())
    const baseServiceChannel = serviceChannels.open(BaseServiceKey)
    baseServiceChannel.call('getSettings').then(state => state).then(state => {
      ;(i18n.global.locale as any).value = state.locale
      state.subscribe('localeSet', (locale) => {
        ;(i18n.global.locale as any).value = locale
      })
    })
    return () => h(BrowseVue)
  },
})

app.use(i18n)
app.use(vuetify)

app.mount('#app')

