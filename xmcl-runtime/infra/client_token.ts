import { InjectionKey } from '~/app'

/**
 * The client token is representing the uuid of current client on this matchine.
 * It will be generated once and stored in the settings storage.
 * It will be used in telemetry to identify a unique client.
 * It will not be changed once generated.
 * It will not be related to the user account.
 */
export const kClientToken: InjectionKey<string> = Symbol('ClientToken')
export const kIsNewClient: InjectionKey<boolean> = Symbol('IsNewClient')
