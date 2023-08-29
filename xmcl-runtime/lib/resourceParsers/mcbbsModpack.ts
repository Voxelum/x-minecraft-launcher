import { McbbsModpackManifest, ResourceDomain, ResourceType } from '@xmcl/runtime-api'
import type { IResourceParser } from './index'

export const mcbbsModpackParser: IResourceParser<McbbsModpackManifest> = {
  type: ResourceType.McbbsModpack,
  domain: ResourceDomain.Modpacks,
  ext: '.zip',
  parseIcon: () => Promise.resolve(undefined),
  parseMetadata: fs => fs.readFile('mcbbs.packmeta', 'utf-8').then(JSON.parse),
  getSuggestedName: () => '',
  getUri: (man) => [`mcbbs:modpack:${man.name}:${man.version}`],
}
