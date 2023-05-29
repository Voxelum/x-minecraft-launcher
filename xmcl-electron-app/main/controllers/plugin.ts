import { ElectronController } from '@/ElectronController'

export interface ControllerPlugin {
  (this: ElectronController): void
}
