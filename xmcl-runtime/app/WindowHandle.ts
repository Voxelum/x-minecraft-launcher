import { InjectionKey } from './objectRegistry'

export const kNativeWindowHandle: InjectionKey<{ get(): Buffer }> = Symbol('NativeWindowHandle')
