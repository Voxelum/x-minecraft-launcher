import VueI18n from 'vue-i18n'
import locales from 'locales'
import Vue from 'vue'

Vue.use(VueI18n)

export default new VueI18n({
    locale: 'en',
    fallbackLocale: 'en',
    messages: locales,
})
