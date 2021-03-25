import VueI18n from 'vue-i18n'

export default function provideVueI18n (locale: string, messages: VueI18n.LocaleMessages) {
  const i18n: any = new VueI18n({
    locale,
    fallbackLocale: 'en',
    messages,
    missing: () => {
      // handle translation missing
    },
    silentTranslationWarn: true,
  })
  const { _t, _tc } = i18n
  i18n._t = function (k: string, v: any, l: any, h: any, ...args: any[]) {
    const result = _t.apply(i18n, [k, v, l, h, ...args])
    if (typeof result === 'object') {
      const fallback = result['']
      if (fallback) { return i18n.formatter.interpolate(fallback, args[0]).join('') }
      return k
    }
    return result
  }
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
      choice].concat(args))
    return result
  }
  // provide(I18N_KEY, i18n);

  return i18n as VueI18n
}
