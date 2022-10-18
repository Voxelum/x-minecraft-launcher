import 'virtual:windi.css'
import Vue, { h } from 'vue'
import VueI18n from 'vue-i18n'
import { castToVueI18n, createI18n } from 'vue-i18n-bridge'
import App from './App.vue'
import { baseService } from './baseService'
import vuetify from './vuetify'
import { I18N_KEY, usePreferDark } from '/@/composables'
import { VuetifyInjectionKey } from '/@/composables/vuetify'

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
      // messages: messages,
    },
    VueI18n,
  ),
) // `createI18n` which is provide `vue-i18n-bridge` has second argument, you **must** pass `VueI18n` constructor which is provide `vue-i18n`

const app = createApp(defineComponent({
  vuetify,
  i18n,
  setup(props, context) {
    provide(VuetifyInjectionKey, context.root.$vuetify)
    provide(I18N_KEY, i18n)

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

    const vuetify = context.root.$vuetify
    const preferDark = usePreferDark()
    const updateTheme = (theme: string) => {
      if (theme === 'system') {
        vuetify.theme.dark = preferDark.value
      } else if (theme === 'dark') {
        vuetify.theme.dark = true
      } else if (theme === 'light') {
        vuetify.theme.dark = false
      }
    }
    updateTheme(theme)

    return () => h(App)
  },
}))
app.mount('#app')
