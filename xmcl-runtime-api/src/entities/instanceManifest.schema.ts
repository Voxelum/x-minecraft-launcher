import { InstanceData, RuntimeVersions } from './instance.schema'

interface Hashes {
  sha1: string
}

/**
 * Represent an instance file
 */
export interface InstanceFile {
  /**
   * The path of the file relative to the instance root
   */
  path: string
  /**
   * The hash of the instance file. The sha1 is required
   */
  hashes: Hashes
  /**
   * The download url of the instance file
   */
  downloads?: string[]
  /**
   * The associated curseforge project/file of the instance file
   */
  curseforge?: {
    projectId: number
    fileId: number
  }
  /**
   * The associated modrinth project/version of the instance file
   */
  modrinth?: {
    projectId: string
    versionId: string
  }
}

export interface LocalInstanceFile extends InstanceFile {
  isDirectory: boolean
  size: number
  createAt: number
  updateAt: number
}

/**
 * This format of manifest is design for xmcl instance pulling/exchanging.
 */
export interface InstanceManifestSchema extends Partial<Pick<InstanceData, 'description' | 'minMemory' | 'maxMemory' | 'vmOptions' | 'mcOptions'>> {
  runtime: RuntimeVersions
  files: Array<InstanceFile>
}

export interface LocalInstanceManifest extends InstanceManifestSchema {
  files: Array<LocalInstanceFile>
}
