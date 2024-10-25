import { InjectionKey } from 'vue'

export const kFlights: InjectionKey<Record<string, object | string | number | boolean>> = Symbol('flights')
