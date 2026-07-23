export type CommercialOAuthProvider = 'microsoft' | 'modrinth' | 'google' | 'discord'

export type CommercialAccountStatus = 'active' | 'merged' | 'deletion_pending' | 'deleted'

export interface CommercialAccount {
  accountId: string
  status: CommercialAccountStatus
  createdAt: string
}

export interface CommercialAccountIdentity {
  provider: CommercialOAuthProvider
  displayName?: string
  linkedBy: 'launcher_bootstrap' | 'launcher_link' | 'web_link'
  linkedAt: string
}

export interface CommercialSessionSummary {
  sessionId: string
  accountId: string
  scopes: string[]
  issuedAt: string
  expiresAt: string
}

/** D1/D4 shared-contract v1 read-only policy; M6 owns account-specific accounting. */
export interface CommercialBackupStoragePolicy {
  freeBytes: 1_073_741_824
  policyVersion: 1
}

export interface CommercialIdentityConflict {
  provider: CommercialOAuthProvider
  mergeId?: string
}

export interface CommercialMergePreview {
  mergeId: string
  resources: Array<{
    type: string
    count?: number
  }>
  expiresAt?: string
}

export interface CommercialAccountError {
  code: string
  message: string
}

export interface CommercialAccountSnapshot {
  account?: CommercialAccount
  identities: CommercialAccountIdentity[]
  session?: CommercialSessionSummary
  backupStoragePolicy?: CommercialBackupStoragePolicy
}

export class CommercialAccountState {
  account: CommercialAccount | undefined
  identities: CommercialAccountIdentity[] = []
  session: CommercialSessionSummary | undefined
  backupStoragePolicy: CommercialBackupStoragePolicy | undefined
  conflict: CommercialIdentityConflict | undefined
  mergePreview: CommercialMergePreview | undefined
  mergeTaskId: string | undefined
  error: CommercialAccountError | undefined

  snapshot(snapshot: CommercialAccountSnapshot) {
    this.account = snapshot.account
    this.identities = snapshot.identities
    this.session = snapshot.session
    this.backupStoragePolicy = snapshot.backupStoragePolicy
    this.conflict = undefined
    this.mergePreview = undefined
    this.mergeTaskId = undefined
    this.error = undefined
  }

  identityConflict(conflict: CommercialIdentityConflict) {
    this.conflict = conflict
    this.error = undefined
  }

  mergePrepared(preview: CommercialMergePreview) {
    this.mergePreview = preview
    this.error = undefined
  }

  mergeQueued(taskId: string) {
    this.mergeTaskId = taskId
    this.mergePreview = undefined
    this.error = undefined
  }

  operationError(error: CommercialAccountError) {
    this.error = error
  }

  clearError() {
    this.error = undefined
  }

  guest() {
    this.account = undefined
    this.identities = []
    this.session = undefined
    this.backupStoragePolicy = undefined
    this.conflict = undefined
    this.mergePreview = undefined
    this.mergeTaskId = undefined
    this.error = undefined
  }
}
