import { InjectionKey } from 'vue'

export const kFlights: InjectionKey<Record<string, object | string | number | boolean>> = Symbol('flights')

export function useI18nSearchFlights() {
  const flights = inject(kFlights, {})
  return flights.i18nSearch && flights.i18nSearch instanceof Array ? flights.i18nSearch as string[] : undefined
}
