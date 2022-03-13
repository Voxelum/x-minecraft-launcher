import VueCompositionApi, { createApp, h } from '@vue/composition-api'
import { BaseServiceKey } from '@xmcl/runtime-api'
import 'virtual:windi.css'
import Vue from 'vue'
import VueI18n from 'vue-i18n'
import BrowseVue from './Browse.vue'
import vuetify from './vuetify'
import '/@/assets/google.font.css'

Vue.use(VueCompositionApi)
Vue.use(VueI18n)

const messages = Object.fromEntries(
  Object.entries(
    import.meta.globEager('./locales/*.y(a)?ml'))
    .map(([key, value]) => {
      const yaml = key.endsWith('.yaml')
      return [key.slice('./locales/'.length, yaml ? -5 : -4), value.default]
    }),
)

const i18n = new VueI18n({
  locale: 'en',
  fallbackLocale: 'en',
  messages,
  missing: () => {
    // handle translation missing
  },
  silentTranslationWarn: true,
})

const baseServiceChannel = serviceChannels.open(BaseServiceKey)

const app = createApp({
  vuetify,
  i18n,
  setup() {
    baseServiceChannel.sync().then(state => {
      i18n.locale = state.state.locale
    })
    baseServiceChannel.on('commit', ({ mutation }) => {
      if (mutation.type === 'localeSet') {
        i18n.locale = mutation.payload
      }
    })

    return () => h(BrowseVue)
  },
})
app.mount('#app')
