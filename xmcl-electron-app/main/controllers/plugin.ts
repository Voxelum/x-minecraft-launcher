import Controller from '@/Controller'

export interface ControllerPlugin {
  (this: Controller): void
}
