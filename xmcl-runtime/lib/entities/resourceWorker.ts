import { ResourceContext } from '../resourceCore'
import { InjectionKey } from '../util/objectRegistry'

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

export const kResourceWorker: InjectionKey<ResourceWorker> = Symbol('ResourceWorker')
/**
 * The worker for cpu busy work
 */
export interface ResourceWorker extends Pick<ResourceContext, 'hash' | 'parse' | 'hashAndFileType'> {
  checksum(path: string, algorithm: string): Promise<string>
  copyPassively(files: { src: string; dest: string }[]): Promise<void>
}
