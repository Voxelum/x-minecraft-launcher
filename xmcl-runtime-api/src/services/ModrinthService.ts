import type { Mod, ModVersion, ModVersionFile, SearchModOptions, SearchModResult } from '@xmcl/modrinth'
import { AnyPersistedResource, PersistedResource } from '../entities/resource'
import { ResourceState } from './ResourceService'
import { ServiceKey, ServiceTemplate, StatefulService } from './Service'

export interface installModVersionOptions {
  version: ModVersion
}

export class ModrinthState {
  downloading = [] as { url: string; taskId: string }[]

  modrinthDownloadFileStart({ url, taskId }: { url: string; taskId: string }) {
    this.downloading.push({ url, taskId })
  }

  modrinthDownloadFileEnd(url: string) {
    this.downloading = this.downloading.filter((f) => f.url !== url)
  }
}

export interface ModrinthService extends StatefulService<ModrinthState> {
  searchMods(options: SearchModOptions): Promise<SearchModResult>

  getMod(modId: string): Promise<Mod>

  getModVersion(versionId: string): Promise<ModVersion>

  getTags(): Promise<{ licenses: string[]; categories: string[]; gameVersions: string[]; modLoaders: string[]; environments: string[] }>

  installModVersion(options: installModVersionOptions): Promise<AnyPersistedResource>
}

export const ModrinthServiceKey: ServiceKey<ModrinthService> = 'ModrinthService'
