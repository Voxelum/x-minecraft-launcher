import { InjectionKey } from '../util/objectRegistry'

export const kGameDataPath: InjectionKey<PathResolver> = Symbol('gameDataPath')

export type PathResolver = (...args: string[]) => string
