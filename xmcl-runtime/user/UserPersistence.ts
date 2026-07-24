import { parsePersistedUsers, Users } from '@xmcl/runtime-api'
import { createHash } from 'crypto'
import { readFile } from 'fs-extra'
import { writeFile } from 'atomically'

const USER_PERSISTENCE_VERSION = 1

export type UserPersistenceIntent = 'automatic' | 'explicit-empty'

export interface UserRecoveryDiagnostic {
  primary: 'valid-nonempty' | 'valid-empty' | 'missing-or-malformed'
  backup: 'valid-nonempty' | 'valid-empty' | 'missing-or-malformed'
  explicitEmpty: boolean
  recoveryAvailable: boolean
}

export interface UserPersistenceLoadResult {
  users: Users
  source: 'primary' | 'backup' | 'empty'
  recoveredFromBackup: boolean
}

interface UserPersistenceMetadata {
  version: typeof USER_PERSISTENCE_VERSION
  emptyState: 'intentional' | 'not-empty'
  contentHash: string
}

interface UserCandidate {
  users: Users | undefined
  status: UserRecoveryDiagnostic['primary']
  contentHash?: string
}

export type AtomicFileWriter = (path: string, data: string) => Promise<void>

const writeAtomically: AtomicFileWriter = (path, data) => writeFile(path, data)

/**
 * Durable persistence for user.json. It deliberately keeps recovery decisions
 * in memory: a corrupt primary is never silently replaced while the launcher
 * is running.
 */
export class UserPersistence {
  readonly backupPath: string
  readonly metadataPath: string

  constructor(
    readonly primaryPath: string,
    private readonly atomicWrite: AtomicFileWriter = writeAtomically,
  ) {
    this.backupPath = `${primaryPath}.backup`
    this.metadataPath = `${primaryPath}.meta`
  }

  async load(): Promise<UserPersistenceLoadResult> {
    const [primary, backup, metadata] = await Promise.all([
      this.readCandidate(this.primaryPath),
      this.readCandidate(this.backupPath),
      this.readMetadata(),
    ])

    if (primary.status === 'valid-nonempty') {
      return { users: primary.users!, source: 'primary', recoveredFromBackup: false }
    }

    if (
      primary.status === 'valid-empty'
      && metadata?.emptyState === 'intentional'
      && metadata.contentHash === primary.contentHash
    ) {
      return { users: primary.users!, source: 'primary', recoveredFromBackup: false }
    }

    if (metadata?.emptyState !== 'intentional' && backup.status === 'valid-nonempty') {
      return { users: backup.users!, source: 'backup', recoveredFromBackup: true }
    }

    if (primary.status === 'valid-empty') {
      return { users: primary.users!, source: 'primary', recoveredFromBackup: false }
    }

    return { users: { users: {} }, source: 'empty', recoveredFromBackup: false }
  }

  /**
   * Reports whether recovery data exists without returning profiles or
   * modifying any files. This is safe to call from diagnostics.
   */
  async diagnoseRecovery(): Promise<UserRecoveryDiagnostic> {
    const [primary, backup, metadata] = await Promise.all([
      this.readCandidate(this.primaryPath),
      this.readCandidate(this.backupPath),
      this.readMetadata(),
    ])
    const explicitEmpty = metadata?.emptyState === 'intentional' && metadata.contentHash === primary.contentHash

    return {
      primary: primary.status,
      backup: backup.status,
      explicitEmpty,
      recoveryAvailable: !explicitEmpty
        && primary.status !== 'valid-nonempty'
        && backup.status === 'valid-nonempty',
    }
  }

  async persist(users: Users, intent: UserPersistenceIntent): Promise<'saved' | 'guarded' | 'skipped'> {
    const persistedUsers = parsePersistedUsers(users) ?? Users.parse(users)
    const userCount = Object.keys(persistedUsers.users).length
    const primary = await this.readCandidate(this.primaryPath)

    if (userCount === 0) {
      if (intent !== 'explicit-empty') {
        const backup = await this.readCandidate(this.backupPath)
        if (primary.status === 'valid-nonempty' || backup.status === 'valid-nonempty') {
          return 'guarded'
        }
        return 'skipped'
      }

      await this.backupPrimaryIfNonEmpty(primary)
      // Persist the intent before the empty primary. A crash after this point
      // must not resurrect a deliberately removed account from the backup.
      const contentHash = this.contentHash(this.serialize(persistedUsers))
      await this.writeMetadata({
        version: USER_PERSISTENCE_VERSION,
        emptyState: 'intentional',
        contentHash,
      })
      await this.writeUsers(persistedUsers)
      return 'saved'
    }

    await this.backupPrimaryIfNonEmpty(primary)
    const contentHash = await this.writeUsers(persistedUsers)
    await this.writeMetadata({
      version: USER_PERSISTENCE_VERSION,
      emptyState: 'not-empty',
      contentHash,
    })
    return 'saved'
  }

  private async backupPrimaryIfNonEmpty(primary: UserCandidate) {
    if (primary.status === 'valid-nonempty' && primary.users) {
      await this.writeJson(this.backupPath, primary.users)
    }
  }

  private async writeUsers(users: Users) {
    const content = this.serialize(users)
    await this.atomicWrite(this.primaryPath, content)
    return this.contentHash(content)
  }

  private async writeMetadata(metadata: UserPersistenceMetadata) {
    await this.writeJson(this.metadataPath, metadata)
  }

  private async writeJson(path: string, value: unknown) {
    await this.atomicWrite(path, this.serialize(value))
  }

  private serialize(value: unknown) {
    return JSON.stringify(value, null, 2)
  }

  private contentHash(content: string) {
    return createHash('sha256').update(content).digest('hex')
  }

  private async readCandidate(path: string): Promise<UserCandidate> {
    try {
      const content = await readFile(path, 'utf-8')
      const raw = JSON.parse(content) as unknown
      const users = parsePersistedUsers(raw)
      if (!users) return { users: undefined, status: 'missing-or-malformed' }
      return {
        users,
        status: Object.keys(users.users).length === 0 ? 'valid-empty' : 'valid-nonempty',
        contentHash: this.contentHash(content),
      }
    } catch {
      return { users: undefined, status: 'missing-or-malformed' }
    }
  }

  private async readMetadata(): Promise<UserPersistenceMetadata | undefined> {
    try {
      const raw = JSON.parse(await readFile(this.metadataPath, 'utf-8')) as Partial<UserPersistenceMetadata>
      if (
        raw.version === USER_PERSISTENCE_VERSION
        && (raw.emptyState === 'intentional' || raw.emptyState === 'not-empty')
        && typeof raw.contentHash === 'string'
      ) {
        return raw as UserPersistenceMetadata
      }
    } catch {
      // A missing or malformed marker is deliberately treated as unknown.
    }
    return undefined
  }
}
