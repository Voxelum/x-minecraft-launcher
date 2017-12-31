import { ActionContext } from 'vuex'

import VueI18n from 'vue-i18n'
import locales from 'locales'
import Vue from 'vue'
import { remote } from 'electron'

Vue.use(VueI18n)

const instance = new VueI18n({
    locale: remote.app.getLocale(),
    fallbackLocale: 'en',
    messages: locales,
    missing: (locale, key, vm) => {
        // handle translation missing
    },
    silentTranslationWarn: true,
})

export default {
    state: {
        lang: instance.locale,
    },
    getters: {
        language: state => state.lang,
        languages: state => Object.keys(locales),
        $t: state => instance.t,
        i18n: state => instance,
    },
    mutations: {
        setLanguage(state, language) {
            state.lang = language;
            instance.locale = state.lang;
        },
    },
    actions: {
        updateSetting(context, payload) {
            if (payload.language && typeof payload.language === 'string') {
                if (context.getters.languages.indexOf(payload.language) !== -1) {
                    context.commit('setLanguage', payload.language);
                }
            }
        },
    },
}
