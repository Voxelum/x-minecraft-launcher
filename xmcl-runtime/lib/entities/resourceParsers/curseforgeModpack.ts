import { CurseforgeModpackManifest, ResourceDomain, ResourceType } from '@xmcl/runtime-api'
import { ResourceParser } from '../resource'

export const curseforgeModpackParser: ResourceParser<CurseforgeModpackManifest> = {
  type: ResourceType.CurseforgeModpack,
  domain: ResourceDomain.Modpacks,
  ext: '.zip',
  parseIcon: () => Promise.resolve(undefined),
  parseMetadata: async (fs) => {
    const manifest: CurseforgeModpackManifest = await fs.readFile('manifest.json', 'utf-8').then(JSON.parse)
    return manifest
  },
  getSuggestedName: () => '',
  getUri: (man) => [`curseforge:modpack:${man.name}:${man.version}`],
}
