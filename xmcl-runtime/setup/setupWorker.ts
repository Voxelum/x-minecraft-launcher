import type Drive from 'node-disk-info/dist/classes/drive'

export interface SetupWorker {
  getDiskInfo(): Promise<Drive[]>
}
