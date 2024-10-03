import { CreateInstanceOption, getInstanceConfigFromCurseforgeModpack } from '@xmcl/runtime-api'
import { readFile } from 'fs-extra'
import { join, sep } from 'path'
import { pathToFileURL } from 'url'
import { Logger } from '~/logger'
import { ResourceWorker } from '~/resource'
import { discover } from './InstanceFileDiscover'
import { ModrinthProfile } from './entities/ModrinthProfile'
import { CurseforgeInstance } from './entities/CurseforgeInstance'

export async function parseCurseforgeInstance(instancePath: string) {
  const data = await readFile(join(instancePath, 'minecraftinstance.json'), 'utf-8')
  const cf = JSON.parse(data) as CurseforgeInstance

  const config = getInstanceConfigFromCurseforgeModpack(cf.manifest)

  const options: CreateInstanceOption = {
    ...config,
    name: cf.name,
    author: cf.customAuthor || config.author,
    lastPlayedDate: new Date(cf.lastPlayed).getTime(),
    assignMemory: !cf.isMemoryOverride ? 'auto' : true,
    minMemory: cf.allocatedMemory ? Number(cf.allocatedMemory) : undefined,
  }

  if (cf.fileID && cf.projectID) {
    options.upstream = {
      type: 'curseforge-modpack',
      modId: cf.projectID,
      fileId: cf.fileID,
    }
  }

  options.resourcepacks = true
  options.shaderpacks = true

  return options
}

export async function parseModrinthInstanceFiles(instancePath: string, worker: ResourceWorker, logger: Logger) {
  const _files = await discover(instancePath, logger, (f) => {
    if (f === 'profile.json') return true
    return false
  })

  const data = await readFile(join(instancePath, 'profile.json'), 'utf-8')
  const modrinth = JSON.parse(data) as ModrinthProfile

  for (const [file] of _files) {
    const osPath = file.path.replace(/\//g, sep)
    const existedProject = modrinth.projects[file.path] || modrinth.projects[osPath]
    file.downloads = [pathToFileURL(join(instancePath, osPath)).toString()]
    if (existedProject) {
      if (typeof existedProject.metadata.version !== 'string' && existedProject.metadata.version) {
        const existedFile = existedProject.metadata.version.files.find(f => f.hashes.sha256 === existedProject.sha512)
        if (existedFile) {
          file.hashes.sha1 = existedFile.hashes.sha1
          file.modrinth = {
            projectId: existedProject.metadata.project.id,
            versionId: existedProject.metadata.version.id,
          }
          file.downloads.push(existedFile.url)
        }
      }
    }
  }

  return _files.map(([file]) => file)
}
