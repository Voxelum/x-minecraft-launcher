import { ServiceKey } from './Service'

export interface OfflineUserService {
  isAllowed(): Promise<boolean>

  removeGameProfile(name: string): Promise<void>
}

export const OfflineUserServiceKey: ServiceKey<OfflineUserService> = 'OfflineUserService'
