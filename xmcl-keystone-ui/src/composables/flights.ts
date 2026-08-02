import { InjectionKey } from 'vue'

export const kFlights: InjectionKey<Record<string, object | string | number | boolean>> = Symbol('flights')

export function useI18nSearchFlights() {
  const flights = inject(kFlights, {})
  const defaultLocales = ['zh-CN', 'zh-TW', 'ru', 'uk', 'pl', 'de', 'fr', 'ja', 'ja-JP']
  if (flights.i18nSearch && flights.i18nSearch instanceof Array) {
    return Array.from(new Set([...(flights.i18nSearch as string[]), ...defaultLocales]))
  }
  return defaultLocales
}

