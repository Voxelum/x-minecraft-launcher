import { InstanceFile, MMCModpackManifest, getInstanceConfigFromMmcModpack } from '@xmcl/instance'
import { readEntry } from '@xmcl/unzip'
import { Entry, ZipFile } from 'yauzl'
import { LauncherApp } from '~/app'
import { ModpackHandler } from '../ModpackService'
import { parseCFG } from './cfg'

export function createMmcHandler(app: LauncherApp): ModpackHandler<MMCModpackManifest> {
  return {
    async resolveModpackMarketMetadata(path, sha1) {
      return undefined
    },
    resolveUnpackPath: function (manifest, e) {
      const overridePrefix = '.minecraft/'
      if (e.fileName.startsWith(overridePrefix)) {
        return e.fileName.substring(overridePrefix.length)
      }
    },
    readManifest: async (zipFile: ZipFile, entries: Entry[]): Promise<MMCModpackManifest | undefined> => {
      const man = entries.find(e => e.fileName === 'mmc-pack.json')
      if (man) {
        const b = await readEntry(zipFile, man)
        const cfg = entries.find(e => e.fileName === 'instance.cfg')
        let parsedCFG
        try {
          parsedCFG = cfg ? parseCFG((await readEntry(zipFile, cfg)).toString()) : {}
        } catch (e) {
          parsedCFG = {}
        }
        return {
          json: JSON.parse(b.toString()),
          cfg: parsedCFG,
        } as MMCModpackManifest
      }
    },
    resolveInstanceOptions: getInstanceConfigFromMmcModpack,
    resolveInstanceFiles: async (): Promise<InstanceFile[]> => {
      return []
    },
  }
}