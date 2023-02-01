import { ServiceKey } from './Service'

export type Activity = {
  location: 'modrinth' | 'curseforge' | 'setting' | 'user' | 'modpack' | 'versions'
} | {
  location: 'modrinth-project' | 'curseforge-project'
  name: string
} | {
  location: 'instance-setting' | 'instance-mods' | 'instance-resourcepacks' | 'instance-shaderpacks' | 'instance-saves'
  instance: string
} | {
  location: 'instance'
  instance: string
  minecraft: string
  forge: string
  fabric: string
}

export interface PresenceService {
  setActivity(activity: Activity): Promise<void>
}

export const PresenceServiceKey: ServiceKey<PresenceService> = 'PresenceService'
