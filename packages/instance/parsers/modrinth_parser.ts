import { readFile } from 'fs-extra'
import { join, sep } from 'path'
import { pathToFileURL } from 'url'
import { RuntimeVersions } from '../instance'
import { InstanceFile } from '../files'
import { getInstanceFiles } from '../files_discovery'
import { Logger } from '../internal_type'
import { CreateInstanceOptions } from '../create'

/**
 * Modrinth project interface (simplified)
 */
export interface Project {
  id: string
  title: string
  description: string
  // Add other fields as needed
}

/**
 * Modrinth project version interface (simplified)
 */
export interface ProjectVersion {
  id: string
  project_id: string
  name: string
  files: Array<{
    hashes: { sha1: string; sha256: string }
    url: string
    filename: string
    primary: boolean
    size: number
  }>
  // Add other fields as needed
}

/**
 * Modrinth profile structure
 */
export interface ModrinthProfile {
  install_stage: 'installed' | string
  /**
   * Relative path like 'Aged'
   */
  path: string
  metadata: {
    name: string
    icon: string
    groups: string[]
    game_version: string
    /**
     * Loader type: 'fabric', 'forge', 'quilt', 'neoforge'
     */
    loader: string
    loader_version: {
      /**
       * Version ID like '0.14.21'
       */
      id: string
      /**
       * URL to loader metadata
       */
      url: string
      stable: boolean
    }
    linked_data?: {
      project_id: string
      version_id: string
      locked: boolean
    }
    date_created: string
    date_modified: string
    last_played: string
    submitted_time_played: number
    recent_time_played: number
  }
  /**
   * The modrinth version id for updates
   */
  modrinth_update_version: string

  /**
   * Project files indexed by relative path
   */
  projects: Record<
    string,
    {
      sha512: string
      disabled: boolean
      file_name: string
      metadata: {
        type: string
        project: Project
        version: ProjectVersion | string | null
        update_version: ProjectVersion | null
        incompatible: boolean
      }
    }
  >
}

/**
 * Parse Modrinth instance configuration
 */
export async function parseModrinthInstance(instancePath: string): Promise<CreateInstanceOptions> {
  const data = await readFile(join(instancePath, 'profile.json'), 'utf-8')
  const modrinth = JSON.parse(data) as ModrinthProfile

  let icon = ''
  if (modrinth.metadata.icon) {
    const url = new URL('http://launcher/media')
    url.searchParams.append('path', modrinth.metadata.icon)
    icon = url.toString()
  }

  const options: CreateInstanceOptions = {
    name: modrinth.metadata.name,
    icon,
    runtime: {
      minecraft: modrinth.metadata.game_version,
      forge: modrinth.metadata.loader === 'forge' ? modrinth.metadata.loader_version.id : undefined,
      fabricLoader:
        modrinth.metadata.loader === 'fabric' ? modrinth.metadata.loader_version.id : undefined,
      quiltLoader:
        modrinth.metadata.loader === 'quilt' ? modrinth.metadata.loader_version.id : undefined,
      neoForged:
        modrinth.metadata.loader === 'neoforge' ? modrinth.metadata.loader_version.id : undefined,
    },
    resourcepacks: true,
    shaderpacks: true,
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

/**
 * Parse Modrinth instance files
 */
export async function parseModrinthInstanceFiles(
  instancePath: string,
  logger?: Logger,
): Promise<InstanceFile[]> {
  const files = await getInstanceFiles(instancePath, logger, (f) => {
    if (f === 'profile.json') return true
    return false
  })

  const data = await readFile(join(instancePath, 'profile.json'), 'utf-8')
  const modrinth = JSON.parse(data) as ModrinthProfile

  for (const [file] of files) {
    const osPath = file.path.replace(/\//g, sep)
    const existedProject = modrinth.projects[file.path] || modrinth.projects[osPath]
    file.downloads = [pathToFileURL(join(instancePath, osPath)).toString()]

    if (existedProject) {
      if (typeof existedProject.metadata.version !== 'string' && existedProject.metadata.version) {
        const existedFile = existedProject.metadata.version.files.find(
          (f) => f.hashes.sha256 === existedProject.sha512,
        )
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

  return files.map(([file]) => file)
}
