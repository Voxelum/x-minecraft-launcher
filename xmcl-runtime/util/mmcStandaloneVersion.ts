import { LibraryInfo } from '@xmcl/core'
import { getMmcLocalLibraryNames, getMmcVersionFromManifest, type MMCModpackManifest } from '@xmcl/instance'
import { createHash } from 'crypto'
import filenamify from 'filenamify'
import { outputFile } from 'fs-extra'
import { join } from 'path'

export interface MmcStandaloneVersionOptions {
  manifest: MMCModpackManifest
  name: string
  gameDirectory: string
  readLocalLibrary: (mavenPath: string) => Promise<Buffer | undefined>
  refreshVersion: (id: string) => Promise<unknown>
}

/**
 * Persist only a version reconstructed from the supported MultiMC patch fields.
 * ZIP and directory imports share IDs, local-library validation and registration.
 */
export async function persistMmcStandaloneVersion({
  manifest, name, gameDirectory, readLocalLibrary, refreshVersion,
}: MmcStandaloneVersionOptions): Promise<string | undefined> {
  const version = getMmcVersionFromManifest(manifest, 'mmc')
  if (!version) return undefined

  // Names alone collide across packs (and with installed vanilla versions).
  const hash = createHash('sha256').update(JSON.stringify(version)).digest('hex').slice(0, 16)
  const id = `mmc-${filenamify(name || 'instance', { maxLength: 80 }).trim() || 'instance'}-${hash}`
  version.id = id

  for (const library of getMmcLocalLibraryNames(version)) {
    const mavenPath = LibraryInfo.resolve(library).path
    const segments = mavenPath.split('/')
    if (segments.some((part) => !part || part === '.' || part === '..' || /[\\:]/.test(part))) {
      throw new Error(`Invalid MultiMC local library path: ${library}`)
    }
    const content = await readLocalLibrary(mavenPath)
    if (!content) {
      throw new Error(`Cannot find local library ${library} (${mavenPath}) in the MultiMC instance`)
    }
    await outputFile(join(gameDirectory, 'libraries', ...segments), content)
  }

  await outputFile(join(gameDirectory, 'versions', id, `${id}.json`), JSON.stringify(version, null, 2))
  await refreshVersion(id)
  return id
}
