import { InjectionKey } from '~/app'

export const kClientToken: InjectionKey<string> = Symbol('ClientToken')
export const kIsNewClient: InjectionKey<boolean> = Symbol('IsNewClient')
