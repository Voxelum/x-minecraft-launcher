export interface BackupStoragePolicyV1 {
  readonly freeBytes: 1_073_741_824
  readonly policyVersion: 1
}

export const BACKUP_STORAGE_POLICY_V1: Readonly<BackupStoragePolicyV1> = Object.freeze({
  freeBytes: 1_073_741_824,
  policyVersion: 1,
})