import { InjectionKey } from '../util/objectRegistry'

export const kEncodingWorker: InjectionKey<EncodingWorker> = Symbol('EncodingWorker')

export interface EncodingWorker {
  decode(buffer: Buffer, encoding: string): Promise<string>
  guessEncodingByBuffer(buffer: Buffer): Promise<string | null>
}
