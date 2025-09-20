import { InjectionKey } from '~/app'

/**
 * The log root is the root directory to store all logs produced by the launcher.
 */
export const kLogRoot: InjectionKey<string> = Symbol('LogRoot')
