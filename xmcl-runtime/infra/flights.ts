import { InjectionKey } from '~/app'

/**
 * The flight is an kv store which fetched from remote server to enable or disable some features.
 * It is used to do A/B test or gradual rollout.
 * The flight will be fetched once per launch and stored in memory.
 * The flight will not be persisted.
 * The flight will be a record of string to any, the value can be boolean, number, string or object.
 */
export const kFlights: InjectionKey<Record<string, any>> = Symbol('Flights')
