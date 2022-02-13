import { CurseforgeModpackManifest, ResourceDomain, ResourceType } from '@xmcl/runtime-api'
import { ResourceParser } from '../resource'

export const curseforgeModpackParser: ResourceParser<CurseforgeModpackManifest> = {
  type: ResourceType.CurseforgeModpack,
  domain: ResourceDomain.Modpacks,
  ext: '.zip',
  parseIcon: () => Promise.resolve(undefined),
  parseMetadata: fs => fs.readFile('manifest.json', 'utf-8').then(JSON.parse),
  getSuggestedName: () => '',
  getUri: (man) => [`curseforge://name/${man.name}/${man.version}`],
}
