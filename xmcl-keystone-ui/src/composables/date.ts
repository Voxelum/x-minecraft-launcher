import { TimeFormatOptions, TimeUnit, getAgoOrDate } from '@/util/date'

export function useDateString() {
  const { t, locale } = useI18n()
  const getDateString = (date: string | number, format?: TimeFormatOptions | undefined) => {
    // Force reactivity: access locale.value to ensure Vue tracks locale changes as a dependency.
    // Without this, the translated string won't update when the locale changes because
    // the date parameter itself hasn't changed. This is needed because getDateString
    // is called directly in templates where Vue needs explicit reactive dependencies.
    const currentLocale = locale.value
    const result = getAgoOrDate(date, format)
    if (typeof result === 'string') {
      return result
    }
    const [ago, unit] = result
    switch (unit) {
      case TimeUnit.Hour:
        return t('ago.hour', { duration: ago }, { plural: ago })
      case TimeUnit.Minute:
        return t('ago.minute', { duration: ago }, { plural: ago })
      case TimeUnit.Second:
        return t('ago.second', { duration: ago }, { plural: ago })
      case TimeUnit.Day:
        return t('ago.day', { duration: ago }, { plural: ago })
    }
    return date.toString()
  }
  return {
    getDateString,
  }
}
