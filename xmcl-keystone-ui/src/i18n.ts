import messages from '@intlify/unplugin-vue-i18n/messages'
import '../locales/en.yaml'
import '../locales/zh-CN.yaml'
import { createI18n } from 'vue-i18n'

export const i18n = createI18n({
  locale: 'en',
  silentTranslationWarn: true,
  missingWarn: false,
  messages,
})
