import Vue from 'vue';
import VueI18n from 'vue-i18n';
import locales from 'static/locales';

Vue.use(VueI18n);

export default function create(store: any) {
    const i18n: any = new VueI18n({
        locale: store.getters.locale,
        fallbackLocale: 'en',
        messages: locales,
        missing: (locale, key, vm) => {
            // handle translation missing
        },
        silentTranslationWarn: true,
    });
    const { _t, _tc } = i18n;
    i18n._t = function (k: string, v: any, l: any, h: any, ...args: any[]) {
        const result = _t.apply(i18n, [k, v, l, h, ...args]);
        if (typeof result === 'object') {
            const fallback = result[''];
            if (fallback) { return i18n.formatter.interpolate(fallback, args[0]).join(''); }
            return k;
        }
        return result;
    };
    i18n._tc = (key: string,
        _locale: any,
        messages: any,
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
    store.watch((state: any) => state.setting.locale, (val: any, oldVal: any) => {
        i18n.locale = val;
        console.log(`language changed ${oldVal} => ${val}`);
    });
    return i18n;
}
