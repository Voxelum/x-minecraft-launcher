import { InjectionKey } from '../util/objectRegistry'

export const kFlights: InjectionKey<Record<string, string>> = Symbol('Flights')
