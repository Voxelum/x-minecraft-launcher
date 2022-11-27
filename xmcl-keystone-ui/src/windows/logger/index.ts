import 'virtual:windi.css'
import Vue, { h } from 'vue'
import VueI18n from 'vue-i18n'
import { castToVueI18n, createI18n } from 'vue-i18n-bridge'
import App from './App.vue'
import { baseService } from './baseService'
import vuetify from './vuetify'
import { usePreferDark } from '@/composables'
import { kVuetify } from '@/composables/vuetify'
import messages from '@intlify/unplugin-vue-i18n/messages'

Vue.use(VueI18n, { bridge: true })

const search = window.location.search.slice(1)
const pairs = search.split('&').map((pair) => pair.split('='))
const locale = pairs.find(p => p[0] === 'locale')?.[1] ?? 'en'
const theme = pairs.find(p => p[0] === 'theme')?.[1] ?? 'dark'

const i18n = castToVueI18n(
  createI18n(
    {
      legacy: false,
      locale: 'en',
      silentTranslationWarn: true,
      missingWarn: false,
      messages,
    },
    VueI18n,
  ),
) // `createI18n` which is provide `vue-i18n-bridge` has second argument, you **must** pass `VueI18n` constructor which is provide `vue-i18n`

Vue.use(i18n)

const app = new Vue(defineComponent({
  vuetify,
  i18n,
  setup(props, context) {
    provide(kVuetify, vuetify.framework)

    baseService.sync().then(({ state }) => {
      i18n.locale = state.locale
      updateTheme(state.theme)
    })
    baseService.on('commit', ({ mutation }) => {
      if (mutation.type === 'localeSet') {
        i18n.locale = mutation.payload
      } else if (mutation.type === 'themeSet') {
        updateTheme(mutation.payload)
      }
    })

    const preferDark = usePreferDark()
    const updateTheme = (theme: string) => {
      if (theme === 'system') {
        vuetify.framework.theme.dark = preferDark.value
      } else if (theme === 'dark') {
        vuetify.framework.theme.dark = true
      } else if (theme === 'light') {
        vuetify.framework.theme.dark = false
      }
    }
    updateTheme(theme)

    return () => h(App)
  },
}))

app.$mount('#app')
