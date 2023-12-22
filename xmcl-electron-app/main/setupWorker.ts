import type Drive from 'node-disk-info/dist/classes/drive'
import { InjectionKey } from '~/app'

export interface SetupWorker {
  getDiskInfo(): Promise<Drive[]>
}

export const kSetupWorker: InjectionKey<SetupWorker> = Symbol('kSetupWorker')
