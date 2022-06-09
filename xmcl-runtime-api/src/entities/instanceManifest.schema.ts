import { InstanceData, RuntimeVersions } from './instance.schema'

/**
 * Represent an instance file
 */
export interface InstanceFile<T extends 'sha1' | 'sha256' | 'md5' = never> {
  /**
   * The path of the file relative to the instance root
   */
  path: string
  /**
   * The hash of the instance file. The sha1 is required
   */
  hashes: {
    [K in T]: string
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

  size: number
  createAt: number
  updateAt: number
}

type InstanceDataFields = Pick<InstanceData, 'description' | 'minMemory' | 'maxMemory' | 'vmOptions' | 'mcOptions'>

/**
 * This format of manifest is design for xmcl instance pulling/exchanging.
 */
export interface InstanceManifestSchema extends Partial<InstanceDataFields> {
  runtime: RuntimeVersions
  files: Array<InstanceFile>
}

export interface InstanceManifest<T extends 'sha1' | 'sha256' | 'md5' = never> extends Partial<InstanceDataFields> {
  runtime: RuntimeVersions
  files: Array<InstanceFile<T>>
}
