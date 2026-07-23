import {
  type PreparedClientWorldBackup,
  type WorldBackupResource,
  type WorldBackupService,
  type WorldBackupStorageUsage,
  WorldBackupServiceKey,
  type WorldBackupTask,
} from '@xmcl/runtime-api'
import type { BackupFormat } from '@xmcl/instance'
import { ref } from 'vue'
import { useService } from './service'

export interface ClientWorldSource {
  instancePath: string
  saveName: string
}

export class WorldBackupClientError extends Error {
  constructor(readonly code: 'insufficient_balance' | 'status_conflict' | 'not_ready', message: string) {
    super(message)
  }
}

function makeIdempotencyKey() {
  return globalThis.crypto?.randomUUID?.() ?? `world-backup-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function newerBackup(left: WorldBackupResource, right: WorldBackupResource) {
  if (left.statusVersion !== right.statusVersion) return left.statusVersion > right.statusVersion ? left : right
  return Date.parse(left.updatedAt) >= Date.parse(right.updatedAt) ? left : right
}

export function mergeWorldBackups(backups: readonly WorldBackupResource[]) {
  const deduplicated = new Map<string, WorldBackupResource>()
  for (const backup of backups) {
    const existing = deduplicated.get(backup.backupId)
    deduplicated.set(backup.backupId, existing ? newerBackup(existing, backup) : backup)
  }
  return [...deduplicated.values()].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
}

/**
 * Renderer coordinator for the M6-local client proposal. All writes are
 * explicit user actions; retrying upload retains the same idempotency keys.
 */
export function useWorldBackups(service: WorldBackupService = useService(WorldBackupServiceKey)) {
  const backups = ref<WorldBackupResource[]>([])
  const storage = ref<WorldBackupStorageUsage>()
  const prepared = ref<PreparedClientWorldBackup>()
  const loading = ref(false)
  const uploading = ref(false)
  const restoring = ref(false)
  const error = ref<Error>()
  let refreshVersion = 0
  let uploadKeys: { create: string; grant: string; complete: string } | undefined

  const applyBackup = (backup: WorldBackupResource) => {
    backups.value = mergeWorldBackups([...backups.value, backup])
  }

  const refresh = async (source: ClientWorldSource) => {
    const current = ++refreshVersion
    loading.value = true
    error.value = undefined
    try {
      const [nextBackups, nextStorage] = await Promise.all([
        service.listClientWorldBackups(source),
        service.getClientWorldBackupStorageUsage(),
      ])
      if (current !== refreshVersion) return
      backups.value = mergeWorldBackups(nextBackups)
      storage.value = nextStorage
    } catch (cause) {
      if (current === refreshVersion) error.value = cause as Error
    } finally {
      if (current === refreshVersion) loading.value = false
    }
  }

  const prepare = async (source: ClientWorldSource, format: BackupFormat, parentBackupId?: string) => {
    error.value = undefined
    prepared.value = undefined
    uploadKeys = undefined
    try {
      prepared.value = await service.prepareClientWorldBackup({
        ...source,
        format,
        parentBackupId,
        idempotencyKey: makeIdempotencyKey(),
      })
      return prepared.value
    } catch (cause) {
      error.value = cause as Error
      throw cause
    }
  }

  const upload = async () => {
    const candidate = prepared.value
    if (!candidate) throw new WorldBackupClientError('status_conflict', 'Prepare a compressed backup object before uploading.')
    if (storage.value?.uploadBlockedReason === 'insufficient_balance') {
      const balanceError = new WorldBackupClientError('insufficient_balance', 'Your balance cannot cover additional backup storage.')
      error.value = balanceError
      throw balanceError
    }
    uploading.value = true
    error.value = undefined
    uploadKeys ??= {
      create: makeIdempotencyKey(),
      grant: makeIdempotencyKey(),
      complete: makeIdempotencyKey(),
    }
    try {
      const created = await service.createWorldBackup({
        sourceId: candidate.sourceId,
        worldId: candidate.worldId,
        object: candidate.object,
        idempotencyKey: uploadKeys.create,
      })
      applyBackup(created)
      if (created.status === 'ready') {
        prepared.value = undefined
        return created
      }
      if (created.status !== 'creating' && created.status !== 'uploading') {
        throw new WorldBackupClientError('status_conflict', `Backup ${created.backupId} cannot be uploaded from ${created.status}.`)
      }
      const grant = await service.requestWorldBackupUpload(created.backupId, candidate.object, uploadKeys.grant)
      await service.uploadPreparedWorldBackup(candidate.snapshotId, grant)
      const completed = await service.completeWorldBackupUpload(created.backupId, candidate.object, uploadKeys.complete)
      applyBackup(completed)
      prepared.value = undefined
      uploadKeys = undefined
      return completed
    } catch (cause) {
      error.value = cause as Error
      throw cause
    } finally {
      uploading.value = false
    }
  }

  const getChain = (backupId: string) => {
    const byId = new Map(backups.value.map(backup => [backup.backupId, backup]))
    const chain: WorldBackupResource[] = []
    const visited = new Set<string>()
    let current = byId.get(backupId)
    while (current && !visited.has(current.backupId)) {
      chain.unshift(current)
      visited.add(current.backupId)
      current = current.parentBackupId ? byId.get(current.parentBackupId) : undefined
    }
    return chain
  }

  const restore = async (source: ClientWorldSource, backup: WorldBackupResource): Promise<WorldBackupTask> => {
    if (backup.status !== 'ready') {
      throw new WorldBackupClientError('not_ready', 'Only a ready backup can restore a player world.')
    }
    restoring.value = true
    error.value = undefined
    try {
      const task = await service.restoreClientWorldBackup({
        ...source,
        backupId: backup.backupId,
        overwriteSelectedWorld: true,
        idempotencyKey: makeIdempotencyKey(),
      })
      applyBackup({ ...backup, status: 'restoring', statusVersion: backup.statusVersion + 1, updatedAt: new Date().toISOString() })
      return task
    } catch (cause) {
      error.value = cause as Error
      throw cause
    } finally {
      restoring.value = false
    }
  }

  return {
    backups,
    storage,
    prepared,
    loading,
    uploading,
    restoring,
    error,
    refresh,
    prepare,
    upload,
    getChain,
    restore,
  }
}
