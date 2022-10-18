import Vue, { h } from 'vue'
import { BaseServiceKey } from '@xmcl/runtime-api'
import 'virtual:windi.css'
import VueI18n from 'vue-i18n'
import BrowseVue from './Browse.vue'
import vuetify from './vuetify'
import { castToVueI18n, createI18n } from 'vue-i18n-bridge'
import messages from '@intlify/unplugin-vue-i18n/messages'

Vue.use(VueI18n, { bridge: true })

const i18n = castToVueI18n(
  createI18n(
    {
      legacy: false,
      locale: 'en',
      silentTranslationWarn: true,
      missingWarn: false,
      messages: messages,
    },
    VueI18n,
  ),
) // `createI18n` which is provide `vue-i18n-bridge` has second argument, you **must** pass `VueI18n` constructor which is provide `vue-i18n`

const baseServiceChannel = serviceChannels.open(BaseServiceKey)

const app = new Vue({
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

app.$mount('#app')
