import { ModrinthModpackManifest, ResourceDomain, ResourceType } from '@xmcl/runtime-api'
import type { IResourceParser } from './index'

export const modrinthModpackParser: IResourceParser<ModrinthModpackManifest> = {
  type: ResourceType.ModrinthModpack,
  domain: ResourceDomain.Modpacks,
  ext: '.mrpack',
  parseIcon: () => Promise.resolve(undefined),
  parseMetadata: fs => fs.readFile('modrinth.index.json', 'utf-8').then(JSON.parse),
  getSuggestedName: (m) => '',
  getUri: (man) => [`modrinth:modpack:${man.name}:${man.versionId}`],
}
