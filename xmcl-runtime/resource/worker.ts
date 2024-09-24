import type { InjectionKey } from '~/app'
import type { ResourceContext } from '../resource/core/ResourceContext'

export const kResourceWorker: InjectionKey<ResourceWorker> = Symbol('ResourceWorker')
/**
 * The worker for cpu busy work
 */
export interface ResourceWorker extends Pick<ResourceContext, 'hash' | 'parse' | 'hashAndFileType'> {
  checksum(path: string, algorithm: string): Promise<string>
  fingerprint(filePath: string): Promise<number>
}
