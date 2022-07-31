import { Resource } from '@xmcl/runtime-api'
import { FileType } from '../util/fs'

export interface WorkPayload {
  type: string
  id: number
  args: any[]
}

export interface ChecksumWorkPayload {
  algorithm: string
  path: string
}

export interface FileTypePayload {
  path: string
}

export interface WorkerResponse {
  id: number
  error?: Error
  result?: any
}

/**
 * The worker for cpu busy work
 */
export interface WorkerInterface {
  checksum(path: string, algorithm: string): Promise<string>
  checksumAndFileType(path: string, algorithm: string): Promise<[string, FileType]>
  fileType(path: string): Promise<FileType>
  parseResourceMetadata(resource: Resource): Promise<{ resource: Resource; icons: Uint8Array[] }>
  copyPassively(files: { src: string; dest: string }[]): Promise<void>
}
