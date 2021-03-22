import { Worker } from 'worker_threads'
import { FileType } from '../util/fs'
import { FileStat } from './resource'
import { ImportTypeHint } from '/@main/service/ResourceService'
import { Resource } from '/@shared/entities/resource.schema'

export interface WorkPayload {
  type: string
  id: number
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
  hint: ImportTypeHint
}

export interface WorkerResponse {
  id: number
  error?: Error
  result?: any
}

/**
 * The worker for cpu busy work
 */
export interface CPUWorker {
  checksum(payload: ChecksumWorkPayload): Promise<string>
  fileType(payload: FileTypePayload): Promise<FileType>
  checksumAndFileType(payload: ChecksumWorkPayload): Promise<[string, FileType]>
  resolveResource(payload: ResolveResourceWorkPayload): Promise<[Resource, Uint8Array | undefined]>
}

export class WorkerAgent implements CPUWorker {
  constructor(private worker: Worker) { }
  private counter = 0

  private post<T>(payload: WorkPayload) {
    this.worker.postMessage(payload)
    return new Promise<T>((resolve, reject) => {
      const handler = (resp: WorkerResponse) => {
        const { error, result, id } = resp
        if (id === payload.id) {
          this.worker?.removeListener('message', handler)
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        }
      }
      this.worker!.on('message', handler)
    })
  }

  submit<T extends keyof CPUWorker>(work: T, payload: Parameters<CPUWorker[T]>[0]): ReturnType<CPUWorker[T]> {
    throw this.post({ type: work, id: this.counter++, ...payload })
  }

  checksum(payload: ChecksumWorkPayload): Promise<string> {
    return this.submit('checksum', payload)
  }

  fileType(payload: FileTypePayload): Promise<FileType> {
    throw this.submit('fileType', payload)
  }

  checksumAndFileType(payload: ChecksumWorkPayload): Promise<[string, FileType]> {
    return this.submit('checksumAndFileType', payload)
  }

  resolveResource(payload: ResolveResourceWorkPayload): Promise<[Resource<unknown>, Uint8Array | undefined]> {
    return this.submit('resolveResource', payload)
  }
}
