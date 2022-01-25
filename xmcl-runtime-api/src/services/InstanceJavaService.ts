import { InstanceState } from './InstanceService'
import { JavaState } from './JavaService'
import { ServiceKey, ServiceTemplate, StatefulService } from './Service'

export class InstanceJavaState {
  private instance: InstanceState

  constructor(instance: InstanceState, private java: JavaState) {
    this.instance = instance
  }
}

/**
 * Provide the service to host the java info of the instance
 */
export interface InstanceJavaService extends StatefulService<InstanceJavaState> {
  diagnoseJava(): Promise<void>
}

export const InstanceJavaServiceKey: ServiceKey<InstanceJavaService> = 'InstanceJavaService'
export const InstanceJavaServiceMethods: ServiceTemplate<InstanceJavaService> = {
  diagnoseJava: undefined,
  state: undefined,
}
