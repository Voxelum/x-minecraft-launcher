import { Worker } from 'worker_threads'
import { ImportTypeHint } from '/@main/service/ResourceService'
import { ResourceHeader } from './resource'

export interface WorkPayload {
    type: string;
    id: number;
}

export interface ChecksumWorkPayload extends WorkPayload {
    type: 'checksum';
    algorithm: string;
    path: string;
}

export interface ReadResourceWorkPayload extends WorkPayload {
    type: 'readResourceHeader';
    path: string;
    hash: string;
    hint: ImportTypeHint;
}

export type WorkPayloads = ChecksumWorkPayload | ReadResourceWorkPayload;

export interface WorkerResponse {
    id: number;
    error?: Error;
    result?: any;
}

/**
 * The worker for cpu busy work
 */
export interface CPUWorker {
    checksum(path: string, algorithm: string): Promise<string>;
    readResourceHeader(path: string, hash: string, hint: ImportTypeHint): Promise<ResourceHeader>
}

export class WorkerProxy implements CPUWorker {
  constructor (private worker: Worker) { }

    private counter = 0;

    private post<T> (payload: WorkPayloads) {
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

    checksum (path: string, algorithm: string): Promise<string> {
      return this.post({ type: 'checksum', path, algorithm, id: this.counter++ })
    }

    readResourceHeader (path: string, hash: string, hint: string): Promise<ResourceHeader> {
      return this.post({ type: 'readResourceHeader', path, hash, hint, id: this.counter++ })
    }
}
