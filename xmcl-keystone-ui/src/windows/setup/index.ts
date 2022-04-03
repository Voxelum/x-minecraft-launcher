import VueCompositionApi, { h, provide, createApp, defineComponent } from '@vue/composition-api'
import Vue from 'vue'
import VueI18n from 'vue-i18n'
import vuetify from './vuetify'
import 'virtual:windi.css'
import Setup from './Setup.vue'
import { I18N_KEY } from '/@/composables'

Vue.config.productionTip = false
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

Vue.use(VueCompositionApi)
const app = createApp(defineComponent({
  vuetify,
  i18n,
  setup() {
    provide(I18N_KEY, i18n)
    return () => h(Setup)
  },
}))
app.mount('#app')
