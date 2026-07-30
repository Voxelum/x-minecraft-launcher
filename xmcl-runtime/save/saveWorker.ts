import { InjectionKey } from '~/app'
import type { RenderedRegion } from './region'

export const kSaveWorker: InjectionKey<SaveWorker> = Symbol('SaveWorker')

/**
 * The worker for cpu busy work of save world rendering. Reading a region file,
 * decompressing every chunk and decoding its surface is heavy enough to block
 * the main thread, so it runs off-thread.
 */
export interface SaveWorker {
  renderSaveRegion(savePath: string, dimension: string, regionX: number, regionZ: number, maxHeight?: number): Promise<RenderedRegion>
}
