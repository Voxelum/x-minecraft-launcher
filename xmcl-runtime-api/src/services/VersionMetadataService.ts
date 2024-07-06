import { ServiceKey } from './Service'

export interface VersionMetadataService {
  getLatestMinecraftRelease(): Promise<string>
  getLatestMinecraftSnapshot(): Promise<string>

  setLatestMinecraft(release: string, snapshot: string): void
}

export const VersionMetadataServiceKey: ServiceKey<VersionMetadataService> = 'VersionMetadataService'
