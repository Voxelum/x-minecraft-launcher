import { ServiceKey } from './Service'

export interface AuthlibInjectorService {
  isAuthlibInjectorReady(): Promise<boolean>
  getOrInstallAuthlibInjector(): Promise<string>
}

export const AuthlibInjectorServiceKey: ServiceKey<AuthlibInjectorService> = 'AuthlibInjectorService'
