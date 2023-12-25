import { ServiceKey } from './Service'

export interface AuthlibInjectorService {
  isAuthlibInjectorReady(): Promise<boolean>
  abortAuthlibInjectorInstall(): Promise<void>
  getOrInstallAuthlibInjector(): Promise<string>
}

export const AuthlibInjectorServiceKey: ServiceKey<AuthlibInjectorService> = 'AuthlibInjectorService'
