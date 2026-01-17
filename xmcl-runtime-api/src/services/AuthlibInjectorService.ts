import { WithDownload } from '@xmcl/installer'
import { Task, SubState } from '../task'
import { ServiceKey } from './Service'

export interface AuthlibInjectorService {
  isAuthlibInjectorReady(): Promise<boolean>
  abortAuthlibInjectorInstall(): Promise<void>
  getOrInstallAuthlibInjector(): Promise<string>
}

export const AuthlibInjectorServiceKey: ServiceKey<AuthlibInjectorService> =
  'AuthlibInjectorService'

export interface InstallAuthlibInjectorTrackerEvents {
  download: WithDownload<{}>
}

export interface InstallAuthlibInjectorTask extends Task {
  type: 'installAuthlibInjector'
  version: string
  substate: SubState<InstallAuthlibInjectorTrackerEvents, 'download'>
}
