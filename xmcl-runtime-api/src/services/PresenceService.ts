import { ServiceKey } from './Service'

export interface PresenceService {
  setActivity(activity: string): Promise<void>
}

export const PresenceServiceKey: ServiceKey<PresenceService> = 'PresenceService'
