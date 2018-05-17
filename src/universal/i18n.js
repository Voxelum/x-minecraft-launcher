import Vue from 'vue';
import VueI18n from 'vue-i18n'
import locales from 'locales'

Vue.use(VueI18n)

export default function create(store) {
    const i18n = new VueI18n({
        locale: store.getters['config/locale'],
        fallbackLocale: 'en',
        messages: locales,
        missing: (locale, key, vm) => {
            // handle translation missing
        },
        silentTranslationWarn: true,
    });
    store.watch(state => state.config.locale, (val, oldVal) => {
        i18n.locale = val;
    });
    return i18n;
}
