import { CreateInstanceOption } from '@xmcl/runtime-api'
import { readFile } from 'fs-extra'
import { join, sep } from 'path'
import { pathToFileURL } from 'url'
import { Logger } from '~/logger'
import { ResourceWorker } from '~/resource'
import { discover } from './InstanceFileDiscover'
import { ModrinthProfile } from './entities/ModrinthProfile'

export async function parseModrinthInstance(instancePath: string) {
  const data = await readFile(join(instancePath, 'profile.json'), 'utf-8')
  const modrinth = JSON.parse(data) as ModrinthProfile

  let icon = ''
  if (modrinth.metadata.icon) {
    const url = new URL('http://launcher/media')
    url.searchParams.append('path', modrinth.metadata.icon)
    icon = url.toString()
  }
  const options: CreateInstanceOption = {
    name: modrinth.metadata.name,
    icon,
    runtime: {
      minecraft: modrinth.metadata.game_version,
      forge: modrinth.metadata.loader === 'forge' ? modrinth.metadata.loader_version.id : undefined,
      fabricLoader: modrinth.metadata.loader === 'fabric' ? modrinth.metadata.loader_version.id : undefined,
      quiltLoader: modrinth.metadata.loader === 'quilt' ? modrinth.metadata.loader_version.id : undefined,
      neoForged: modrinth.metadata.loader === 'neoforge' ? modrinth.metadata.loader_version.id : undefined,
    },
  }

  if (modrinth.metadata.linked_data) {
    options.upstream = {
      type: 'modrinth-modpack',
      projectId: modrinth.metadata.linked_data.project_id,
      versionId: modrinth.metadata.linked_data.version_id,
    }
  }

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
