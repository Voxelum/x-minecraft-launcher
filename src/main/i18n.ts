import Vue from 'vue';
import VueI18n from 'vue-i18n';
import locales from 'static/locales';

Vue.use(VueI18n);

// TODO: refactor

const i18n: any = new VueI18n({
    locale: 'en',
    fallbackLocale: 'en',
    messages: locales,
    missing: (locale, key, vm) => {
        // handle translation missing
    },
    silentTranslationWarn: true,
});
const { _t, _tc } = i18n as any;
i18n._t = function (k: string, v: any, l: any, h: any, ...args: any[]) {
    if (args[0] instanceof Array) {
        args = args[0];
    }
    const result = _t.apply(i18n, [k, v, l, h, ...args]);
    if (typeof result === 'object') {
        const fallback = result[''];
        if (fallback) {
            return i18n.formatter.interpolate(fallback, args[0]).join('');
        }
        return k;
    }
    return result;
};
i18n._tc = (key: string,
    _locale: any,
    messages: any[],
    host: any,
    choice: any, ...args: any[]) => {
    const result = _tc.apply(i18n, [
        key,
        _locale,
        messages,
        host,
        choice].concat(args));
    return result;
};

export default i18n;
