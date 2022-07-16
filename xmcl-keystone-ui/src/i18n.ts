import VueI18n from 'vue-i18n'

export function createI18n(locale: string, messages: VueI18n.LocaleMessages) {
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

  // @ts-ignore
  const originalCreateContext = VueI18n.prototype._createMessageContext as unknown as Function

  // @ts-ignore
  VueI18n.prototype._createMessageContext = function _createMessageContext(values: any, formatter: any, path: any, interpolateMode: any) {
    const result = originalCreateContext.call(this, values, formatter, path, interpolateMode)

    const normalize = (values: string[]) => values.length === 0 ? '' : values.join('')
    const plural = (messages: string[]) => {
      if (messages.length === 2) {
        if (values.n % 2 === 0) {
          return messages[1]
        }
        return messages[0]
      }
      if (messages.length === 3) {
        if (values.n === 0) {
          return messages[0]
        }
        if (values.n % 2 === 0) {
          return messages[2]
        }
        return messages[1]
      }
      let result: any
      if (messages.length <= values.n) {
        result = messages[values.n % messages.length]
      } else {
        result = messages[values.n]
      }
      return result
    }
    const interpolate = (v: any) => {
      return v
    }
    return {
      ...result,
      plural,
      interpolate,
      normalize,
    }
  }

  i18n._t = function (k: string, v: any, l: any, h: any, ...args: any[]) {
    const result = _t.apply(i18n, [k, v, l, h, ...args])
    if (typeof result === 'object' && !(result instanceof Array)) {
      const fallback = result
      if (fallback) { return _t.apply(i18n, [`${k}.name`, v, l, h, ...args]) }
      return k
    }
    if (result instanceof Array) {
      return result[0]
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
    // console.log(`${key} -> ${result}`)
    return result
  }

  return i18n as VueI18n
}
