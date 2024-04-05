import { InjectionKey } from './objectRegistry'

export const kGameDataPath: InjectionKey<PathResolver> = Symbol('gameDataPath')
export const kTempDataPath: InjectionKey<PathResolver> = Symbol('tempDataPath')

export type PathResolver = (...args: string[]) => string
