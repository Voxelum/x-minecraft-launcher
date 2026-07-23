import {
  createLinearBackup,
  LINEAR_BACKUP_FORMAT_VERSION,
  LinearBackupEntry,
  LinearBackupObjectInput,
  PreparedLinearBackup,
  validateLinearBackupObjectInput,
} from './linear-backup'

export interface LayeredLinearBackupObject {
  format: 'layered_linear'
  formatVersion: typeof LINEAR_BACKUP_FORMAT_VERSION
  parentBackupId: string
  sizeBytes: number
  sha256: string
}

export interface LayeredLinearBackupObjectInput extends LinearBackupObjectInput {
  parentBackupId: string
}

export interface PreparedLayeredLinearBackup {
  object: LayeredLinearBackupObject
  content: Uint8Array
}

export function createLayeredLinearBackupObject(
  input: LayeredLinearBackupObjectInput,
): LayeredLinearBackupObject {
  validateLinearBackupObjectInput(input)
  if (input.parentBackupId.trim().length === 0) {
    throw new TypeError('Layered Linear backup parentBackupId must not be empty')
  }
  return {
    format: 'layered_linear',
    formatVersion: LINEAR_BACKUP_FORMAT_VERSION,
    parentBackupId: input.parentBackupId,
    sizeBytes: input.sizeBytes,
    sha256: input.sha256.toLowerCase(),
  }
}

/**
 * A layer is encoded as the same opaque Linear payload as a base object. Its
 * parent reference is metadata, so object storage receives no raw directory
 * and restore can replay the parent chain in order.
 */
export function createLayeredLinearBackup(
  entries: readonly LinearBackupEntry[],
  parentBackupId: string,
): PreparedLayeredLinearBackup {
  const prepared: PreparedLinearBackup = createLinearBackup(entries)
  return {
    object: createLayeredLinearBackupObject({
      ...prepared.object,
      parentBackupId,
    }),
    content: prepared.content,
  }
}