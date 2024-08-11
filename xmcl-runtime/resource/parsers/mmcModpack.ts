import { MMCModpackManifest, ResourceDomain, ResourceType } from '@xmcl/runtime-api'
import type { IResourceParser } from './index'
import { parseCFG } from '~/util/cfg'

export const mmcModpackParser: IResourceParser<MMCModpackManifest> = {
  type: ResourceType.MMCModpack,
  domain: ResourceDomain.Modpacks,
  ext: '.zip',
  parseIcon: () => Promise.resolve(undefined),
  parseMetadata: async fs => {
    const text = await fs.readFile('mmc-pack.json', 'utf-8')
    const cfg = await fs.readFile('instance.cfg', 'utf-8').catch(() => '')
    const parsedCFG = cfg ? parseCFG(cfg) : {}
    return {
      json: JSON.parse(text),
      cfg: {
        name: parsedCFG.name || '',
        notes: parsedCFG.notes || '',
      },
    } as MMCModpackManifest
  },
  getSuggestedName: () => '',
  getUri: (man) => [`mmc:modpack:${man.cfg.name}}`],
}
