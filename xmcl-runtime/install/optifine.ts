import { OptifineVersion } from '@xmcl/runtime-api'
import { InjectionKey } from '~/app'

export const kOptifineInstaller: InjectionKey<(version: OptifineVersion) => Promise<string>> = Symbol('kOptifineInstaller')
