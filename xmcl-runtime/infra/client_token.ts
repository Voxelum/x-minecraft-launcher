import { InjectionKey } from '~/app'

/**
 * The client token is a random UUID generated once per installation and
 * stored in the settings storage. It is the only telemetry identity: it
 * identifies this installation pseudonymously and is never linked to a
 * user account.
 */
export const kClientToken: InjectionKey<string> = Symbol('ClientToken')
export const kIsNewClient: InjectionKey<boolean> = Symbol('IsNewClient')
