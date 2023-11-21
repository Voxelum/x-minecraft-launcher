import { CurseforgeModpackManifest, EditInstanceOptions, McbbsModpackManifest, ModpackFileInfoCurseforge, ModrinthModpackManifest } from '@xmcl/runtime-api'
import { readEntry } from '@xmcl/unzip'
import { Entry, ZipFile } from 'yauzl'

/**
 * Read the metadata of the modpack
 * @param zip The modpack zip
 * @returns The curseforge or mcbbs manifest
 */
export async function readMetadata(zip: ZipFile, entries: Entry[]) {
  const mcbbsManifest = entries.find(e => e.fileName === 'mcbbs.packmeta')
  if (mcbbsManifest) {
    return readEntry(zip, mcbbsManifest).then(b => JSON.parse(b.toString()) as McbbsModpackManifest)
  }
  const curseforgeManifest = entries.find(e => e.fileName === 'manifest.json')
  if (curseforgeManifest) {
    return readEntry(zip, curseforgeManifest).then(b => JSON.parse(b.toString()) as CurseforgeModpackManifest)
  }
  const modrinthManifest = entries.find(e => e.fileName === 'modrinth.index.json')
  if (modrinthManifest) {
    return readEntry(zip, modrinthManifest).then(b => JSON.parse(b.toString()) as ModrinthModpackManifest)
  }
  throw new Error()
}

export function resolveInstanceOptions(manifest: McbbsModpackManifest | CurseforgeModpackManifest | ModrinthModpackManifest): EditInstanceOptions {
  const options: EditInstanceOptions = {
  }
  if ('formatVersion' in manifest) {
    options.version = manifest.versionId
    options.name = manifest.name
    options.description = manifest.summary
    options.runtime = {
      minecraft: manifest.dependencies.minecraft,
      forge: manifest.dependencies.forge,
      fabricLoader: manifest.dependencies['fabric-loader'],
      quiltLoader: manifest.dependencies['quilt-loader'],
    }
  } else {
    options.author = manifest.author
    options.version = manifest.version
    options.name = manifest.name
    if ('addons' in manifest) {
      options.description = manifest.description
      options.url = manifest.url
      options.runtime = {
        minecraft: manifest.addons.find(a => a.id === 'game')?.version ?? '',
        forge: manifest.addons.find(a => a.id === 'forge')?.version ?? '',
        liteloader: '',
        fabricLoader: manifest.addons.find(a => a.id === 'fabric')?.version ?? '',
        yarn: '',
      }
      if (manifest.launchInfo) {
        if (manifest.launchInfo.launchArgument) {
          options.mcOptions = manifest.launchInfo.launchArgument
        }
        if (manifest.launchInfo.javaArgument) {
          options.vmOptions = manifest.launchInfo.javaArgument
        }
        if (manifest.launchInfo.minMemory) {
          options.minMemory = Number(manifest.launchInfo.minMemory)
        }
      // if (manifest.launchInfo.supportJava) {
      // options.java
      // }
      }
    } else {
      const forgeId = manifest.minecraft.modLoaders.find(l => l.id.startsWith('forge'))
      const fabricId = manifest.minecraft.modLoaders.find(l => l.id.startsWith('fabric'))
      options.runtime = {
        minecraft: manifest.minecraft.version,
        forge: forgeId ? forgeId.id.substring(6) : '',
        liteloader: '',
        fabricLoader: fabricId ? fabricId.id.substring(7) : '',
        yarn: '',
      }
    }
  }

  return options
}

export class ModpackInstallGeneralError extends Error {
  constructor(readonly files: {
    path: string
    url: string
    projectId: number
    fileId: number
  }[], e: Error) { super(`Fail to install modpack: ${e.message}`) }
}

export class ModpackInstallUrlError extends Error {
  constructor(readonly file: ModpackFileInfoCurseforge) {
    super(`Fail to get curseforge download url project=${file.projectID} file=${file.fileID}`)
    this.name = 'ModpackInstallUrlError'
  }
}
