import { ServiceKey } from './Service'

/**
 * Provide the service to host the java info of the instance
 */
export interface InstanceJavaService {
  diagnoseJava(): Promise<void>
}

export const InstanceJavaServiceKey: ServiceKey<InstanceJavaService> = 'InstanceJavaService'
