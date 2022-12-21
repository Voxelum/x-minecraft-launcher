import { Version } from '@xmcl/core'
import { RuntimeVersions, ResourceType, ResourceDomain, resolveRuntimeVersion } from '@xmcl/runtime-api'
import type { IResourceParser } from './index'

export const modpackParser: IResourceParser<{ root: string; runtime: RuntimeVersions }> = ({
  type: ResourceType.Modpack,
  domain: ResourceDomain.Modpacks,
  ext: '.zip',
  parseIcon: () => Promise.resolve(undefined),
  parseMetadata: async (fs) => {
    const findRoot = async () => {
      if (await fs.isDirectory('./versions') &&
        await fs.isDirectory('./mods')) {
        return ''
      }
      if (await fs.isDirectory('.minecraft')) {
        return '.minecraft'
      }
      const files = await fs.listFiles('')
      for (const file of files) {
        if (await fs.isDirectory(file)) {
          if (await fs.isDirectory(fs.join(file, 'versions')) &&
            await fs.isDirectory(fs.join(file, 'mods'))) {
            return file
          }
          if (await fs.isDirectory(fs.join(file, '.minecraft'))) {
            return fs.join(file, '.minecraft')
          }
        }
      }
      throw new Error()
    }
    const root = await findRoot()
    const versions = await fs.listFiles(fs.join(root, 'versions'))
    const runtime: RuntimeVersions = {
      minecraft: '',
      fabricLoader: '',
      forge: '',
      liteloader: '',
      yarn: '',
    }
    for (const version of versions) {
      const json = await fs.readFile(fs.join(fs.join(root, 'versions', version, `${version}.json`)), 'utf-8')
      const partialVersion = Version.normalizeVersionJson(json, '')

      resolveRuntimeVersion(partialVersion, runtime)
    }

    return { root, runtime }
  },
  getSuggestedName: () => '',
  getUri: (_) => [],
})
