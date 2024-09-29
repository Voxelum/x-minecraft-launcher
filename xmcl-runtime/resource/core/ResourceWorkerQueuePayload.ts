import { File, ResourceMetadata } from '@xmcl/runtime-api'
import { ResourceSnapshotTable } from './schema'

export interface ResourceWorkerQueuePayload {
  filePath: string
  file?: File
  record?: ResourceSnapshotTable
  metadata?: ResourceMetadata
  uris?: string[]
  icons?: string[]
}
