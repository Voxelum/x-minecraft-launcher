import { InjectionKey } from './objectRegistry'

export const kGameDataPath: InjectionKey<PathResolver> = Symbol('gameDataPath')

export type PathResolver = (...args: string[]) => string
