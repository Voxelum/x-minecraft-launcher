import { ModrinthModpackManifest, ResourceDomain, ResourceType } from '@xmcl/runtime-api'
import { ResourceParser } from '../resource'

export const modrinthModpackParser: ResourceParser<ModrinthModpackManifest> = {
  type: ResourceType.ModrinthModpack,
  domain: ResourceDomain.Modpacks,
  ext: '.mrpack',
  parseIcon: () => Promise.resolve(undefined),
  parseMetadata: fs => fs.readFile('modrinth.index.json', 'utf-8').then(JSON.parse),
  getSuggestedName: (m) => m.name,
  getUri: (man) => [`modrinth://modpack/${man.name}/${man.versionId}`],
}
