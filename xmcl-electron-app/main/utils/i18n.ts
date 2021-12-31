interface LocalizationData {
  [key: string]: string | LocalizationData
}

export function createI18n(i18nMap: { [local: string]: LocalizationData }, defaultLocal: string) {
  const defaultData: LocalizationData = i18nMap[defaultLocal]

  let usingLocale = defaultLocal
  let usingData: LocalizationData = defaultData
  function find(queryPath: string[], node: LocalizationData): string | LocalizationData | undefined {
    if (!node) {
      return undefined
    }
    let content: LocalizationData | string = node
    for (const p of queryPath) {
      if (typeof content === 'string') return undefined
      const next: LocalizationData | string | undefined = content[p]
      if (!next) return undefined
      content = next
    }
    return content
  }
  function format(templateString: string, args?: object) {
    if (!args) { return templateString }
    let result = templateString
    for (const [k, v] of Object.entries(args)) {
      result = result.replace(`{${k}}`, v.toString())
    }
    return result
  }
  function t(key: string, args?: object) {
    const queryPath = key.split('.')
    const result = find(queryPath, usingData) || find(queryPath, defaultData)
    if (!result) return key
    const templateString = typeof result === 'object' ? result[''] as string : result
    return format(templateString, args)
  }
  return {
    t,
    use(locale: string) {
      usingLocale = locale
      usingData = i18nMap[locale]
    },
    get locales() { return Object.keys(i18nMap) },
    get locale() { return usingLocale },
  }
}
