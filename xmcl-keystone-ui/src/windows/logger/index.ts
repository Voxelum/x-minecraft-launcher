import VueCompositionApi, { createApp, h, InjectionKey } from '@vue/composition-api'
import App from './App.vue'
import vuetify from './vuetify'
import Vue from 'vue'
import 'virtual:windi.css'
import { VuetifyInjectionKey } from '/@/composables/vuetify'
import { I18N_KEY, SERVICES_KEY, usePreferDark } from '/@/composables'
import VueI18n from 'vue-i18n'
import { BaseServiceKey, ServiceChannel } from '@xmcl/runtime-api'
import { baseService } from './baseService'

Vue.use(VueI18n)

const messages = Object.fromEntries(
  Object.entries(
    import.meta.globEager('./locales/*.y(a)?ml'))
    .map(([key, value]) => {
      const yaml = key.endsWith('.yaml')
      return [key.slice('./locales/'.length, yaml ? -5 : -4), value.default]
    }),
)

const search = window.location.search.slice(1)
const pairs = search.split('&').map((pair) => pair.split('='))
const locale = pairs.find(p => p[0] === 'locale')?.[1] ?? 'en'
const theme = pairs.find(p => p[0] === 'theme')?.[1] ?? 'dark'

const i18n = new VueI18n({
  locale: locale,
  fallbackLocale: 'en',
  messages,
  missing: () => {
    // handle translation missing
  },
  silentTranslationWarn: true,
})
Vue.use(VueCompositionApi)
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
