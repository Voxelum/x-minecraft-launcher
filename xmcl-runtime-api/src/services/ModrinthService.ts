import type { Mod, ModVersion, ModVersionFile, SearchModOptions, SearchModResult } from '@xmcl/modrinth'
import { AnyPersistedResource, PersistedResource } from '../entities/resource'
import { ResourceState } from './ResourceService'
import { ServiceKey, ServiceTemplate, StatefulService } from './Service'

export interface installModVersionOptions {
  version: ModVersion
}

export class ModrinthState {
  downloading = [] as { url: string; taskId: string }[]

  constructor(private resourceState: ResourceState) {
  }

  get isFileInstalled() {
    return (file: { url: string }) => {
      const find = (m: PersistedResource) => {
        if ('modrinth' in m && typeof m.modrinth === 'object') {
          const s = m.modrinth
          if (s.url === file.url) return true
        }
        return false
      }
      if (this.resourceState.mods.find(find)) return true
      if (this.resourceState.resourcepacks.find(find)) return true
      if (this.resourceState.modpacks.find(find)) return true
      if (this.resourceState.saves.find(find)) return true

      return false
    }
  }

  get findFileInstalled() {
    return (file: { url: string }) => {
      const find = (m: PersistedResource) => {
        const source = m
        if ('modrinth' in source && typeof source.modrinth === 'object') {
          const s = source.modrinth
          if (s.url === file.url) return true
        }
        return false
      }
      let result
      /* eslint-disable no-cond-assign */
      if (result = this.resourceState.mods.find(find)) return result
      if (result = this.resourceState.resourcepacks.find(find)) return result
      if (result = this.resourceState.modpacks.find(find)) return result
      if (result = this.resourceState.saves.find(find)) return result
      /* eslint-enable no-cond-assign */

      return undefined
    }
  }

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
export const ModrinthServiceMethods: ServiceTemplate<ModrinthService> = {
  searchMods: undefined,
  getMod: undefined,
  getModVersion: undefined,
  installModVersion: undefined,
  getTags: undefined,
  state: undefined,
}
