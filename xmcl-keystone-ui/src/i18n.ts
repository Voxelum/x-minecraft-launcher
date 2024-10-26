// import messages from '@intlify/unplugin-vue-i18n/messages'
import Vue from 'vue'
import VueI18n from 'vue-i18n'
import { castToVueI18n, createI18n } from 'vue-i18n-bridge'
// @ts-ignore
import en from '../locales/en.yaml'

Vue.use(VueI18n, { bridge: true })

export const i18n = castToVueI18n(
  createI18n(
    {
      legacy: false,
      locale: 'en',
      silentTranslationWarn: true,
      missingWarn: false,
      fallbackWarn: false,
      messages: {
        en,
      },
    },
    VueI18n,
  ),
)

Vue.use(i18n)
