import { FileTypeHint, Resource } from '@xmcl/runtime-api'
import { FileType } from '../util/fs'
import { FileStat } from './resource'

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

export interface ResolveResourceWorkPayload {
  path: string
  sha1: string
  fileType: FileType
  stat: FileStat
  hint: FileTypeHint
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
  parseResource(payload: ResolveResourceWorkPayload): Promise<[Resource, Uint8Array | undefined]>
  copyPassively(files: { src: string; dest: string }[]): Promise<void>
}
