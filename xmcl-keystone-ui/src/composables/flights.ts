import { InjectionKey } from 'vue'

export const kFlights: InjectionKey<Record<string, string>> = Symbol('flights')
