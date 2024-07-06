import { InstanceData, RuntimeVersions } from './instance.schema'

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
  hashes: {
    [hash: string]: string
  }
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
  /**
   * The file size in bytes
   */
  size?: number
}

type InstanceDataFields = Pick<InstanceData, 'description' | 'minMemory' | 'maxMemory' | 'vmOptions' | 'mcOptions' | 'name'>

/**
 * This format of manifest is design for xmcl instance pulling/exchanging.
 */
export interface InstanceManifest extends Partial<InstanceDataFields> {
  runtime: RuntimeVersions
  files: Array<InstanceFile>
}
