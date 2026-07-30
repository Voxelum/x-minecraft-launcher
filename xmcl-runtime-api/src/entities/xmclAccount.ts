export type XmclOAuthProvider = 'microsoft' | 'modrinth' | 'google' | 'discord'

export type XmclAccountStatus = 'active' | 'merged' | 'deletion_pending' | 'deleted'

export interface XmclAccount {
  accountId: string
  status: XmclAccountStatus
  createdAt: string
}

export interface XmclAccountIdentity {
  provider: XmclOAuthProvider
  displayName?: string
  linkedBy: 'launcher_bootstrap' | 'launcher_link' | 'web_link'
  linkedAt: string
}

export interface XmclSessionSummary {
  sessionId: string
  accountId: string
  scopes: string[]
  issuedAt: string
  expiresAt: string
}

/** D1/D4 shared-contract v1 read-only policy; M6 owns account-specific accounting. */
export interface XmclBackupStoragePolicy {
  freeBytes: 1_073_741_824
  policyVersion: 1
}

export interface XmclIdentityConflict {
  provider: XmclOAuthProvider
  mergeId?: string
}

export interface XmclMergePreview {
  mergeId: string
  resources: Array<{
    type: string
    count?: number
  }>
  expiresAt?: string
}

export interface XmclAccountError {
  code: string
  message: string
}

export interface XmclAccountSnapshot {
  account?: XmclAccount
  identities: XmclAccountIdentity[]
  session?: XmclSessionSummary
  backupStoragePolicy?: XmclBackupStoragePolicy
}

export class XmclAccountState {
  account: XmclAccount | undefined
  identities: XmclAccountIdentity[] = []
  session: XmclSessionSummary | undefined
  backupStoragePolicy: XmclBackupStoragePolicy | undefined
  conflict: XmclIdentityConflict | undefined
  mergePreview: XmclMergePreview | undefined
  mergeTaskId: string | undefined
  error: XmclAccountError | undefined

  snapshot(snapshot: XmclAccountSnapshot) {
    this.account = snapshot.account
    this.identities = snapshot.identities
    this.session = snapshot.session
    this.backupStoragePolicy = snapshot.backupStoragePolicy
    this.conflict = undefined
    this.mergePreview = undefined
    this.mergeTaskId = undefined
    this.error = undefined
  }

  identityConflict(conflict: XmclIdentityConflict) {
    this.conflict = conflict
    this.error = undefined
  }

  mergePrepared(preview: XmclMergePreview) {
    this.mergePreview = preview
    this.error = undefined
  }

  mergeQueued(taskId: string) {
    this.mergeTaskId = taskId
    this.mergePreview = undefined
    this.error = undefined
  }

  operationError(error: XmclAccountError) {
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
