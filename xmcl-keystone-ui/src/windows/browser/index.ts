import VueCompositionApi, { createApp, h, provide } from '@vue/composition-api'
import Vue from 'vue'
import BrowseVue from './Browse.vue'
import VueI18n from 'vue-i18n'
import Vuetify from 'vuetify'
import 'vuetify/dist/vuetify.min.css'
import '/@/assets/google.font.css'
import colors from 'vuetify/es5/util/colors'
import 'virtual:windi.css'
import { BaseServiceKey } from '@xmcl/runtime-api'

Vue.use(VueCompositionApi)
Vue.use(VueI18n)

const i18n = new VueI18n({
  locale: 'en',
  fallbackLocale: 'en',
  messages: {
    en: {
      createShortcut: 'Create Shortcut',
      launch: 'Launch and set as Default',
      delete: 'Delete',
      default: 'DEFAULT',
    },
    'zh-CN': {
      createShortcut: '创建快捷方式',
      launch: '启动并设置为默认',
      delete: '删除',
      default: '默认',
    },
  },
  missing: () => {
    // handle translation missing
  },
  silentTranslationWarn: true,
})

const baseServiceChannel = serviceChannels.open(BaseServiceKey)

const app = createApp({
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
app.use(Vuetify, {
  theme: {
    primary: colors.green,
    // secondary: colors.green,
    accent: colors.green.accent3,
  },
})
app.mount('#app')
