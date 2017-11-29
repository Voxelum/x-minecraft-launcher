import VueI18n from 'vue-i18n'
import locales from 'locales'
import Vue from 'vue'
import { remote } from 'electron'

Vue.use(VueI18n)

export default new VueI18n({
    locale: 'zh_cn',
    fallbackLocale: 'en',
    messages: locales,
    missing: (locale, key, vm) => {
        // handle translation missing
    },
    silentTranslationWarn: true,
})
