import type { InjectionKey } from '~/app'
import type { ResourceContext } from '@xmcl/resource'

export const kResourceWorker: InjectionKey<ResourceWorker> = Symbol('ResourceWorker')
/**
 * The worker for cpu busy work
 */
export interface ResourceWorker extends Pick<ResourceContext, 'parse' | 'hashAndFileType'> {
  hash(file: string, size: number): Promise<string>
  checksum(path: string, algorithm: string): Promise<string>
  checksum(path: string, algorithm: 'crc32'): Promise<number>
  fingerprint(filePath: string): Promise<number>
}
