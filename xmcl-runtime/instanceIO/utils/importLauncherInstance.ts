import {
  getMultiMCGameDirectory,
  isMultiMCInstance,
  parseMultiMCInstance,
  readMultiMCManifest,
  type CreateInstanceOptions,
} from '@xmcl/instance'
import { copy, readFile, stat } from 'fs-extra'
import { basename, dirname, join, relative, sep } from 'path'
import { persistMmcStandaloneVersion } from '../../util/mmcStandaloneVersion'

const sharedFolders = new Set(['libraries', 'assets', 'versions', 'java_versions', 'jre'])

export async function importLauncherInstance(
  instance: { path: string; options: CreateInstanceOptions },
  gameDirectory: string,
  createInstance: (options: CreateInstanceOptions) => Promise<string>,
  refreshVersion: (id: string) => Promise<unknown>,
): Promise<void> {
  const { path } = instance
  const mmc = isMultiMCInstance(path)
  const source = mmc ? getMultiMCGameDirectory(path) : path
  if (!(await stat(source)).isDirectory()) {
    throw new Error(`Invalid instance directory: ${source}`)
  }
  let options = { ...instance.options, name: instance.options.name || basename(path) }
  if (mmc) {
    // Re-read the source rather than trusting version metadata round-tripped
    // through the migration preview.
    const manifest = await readMultiMCManifest(path)
    const parsed = await parseMultiMCInstance(path, manifest)
    const version = await persistMmcStandaloneVersion({
      manifest,
      name: options.name,
      gameDirectory,
      refreshVersion,
      readLocalLibrary: async (mavenPath) => {
        const fileName = basename(mavenPath)
        const candidates = [
          join(dirname(source), 'libraries', fileName),
          join(dirname(source), 'libraries', ...mavenPath.split('/')),
          join(source, 'libraries', fileName),
          join(source, 'libraries', ...mavenPath.split('/')),
        ]
        for (const candidate of candidates) {
          try {
            return await readFile(candidate)
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
          }
        }
        return undefined
      },
    })
    options = { ...options, ...parsed, name: options.name, version: version || '' }
  }

  const destination = await createInstance(options)
  await copy(source, destination, {
    overwrite: false,
    filter: (file) => !sharedFolders.has(relative(source, file).split(sep)[0]),
  })
}
