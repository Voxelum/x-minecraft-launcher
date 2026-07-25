import { afterEach, describe, expect, test } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { UserPersistence, type AtomicFileWriter } from './UserPersistence'

const user = (id: string, token = 'access-token-secret') => ({
  id,
  username: `${id}@example.com`,
  invalidated: false,
  authority: 'https://auth.example.com',
  expiredAt: 0,
  profiles: {},
  selectedProfile: '',
  token,
})

const users = (id: string) => ({ users: { [id]: user(id) } })

describe('UserPersistence', () => {
  const directories: string[] = []

  async function createPersistence(writer?: AtomicFileWriter) {
    const directory = await mkdtemp(join(process.cwd(), '.test-user-persistence-'))
    directories.push(directory)
    const primaryPath = join(directory, 'user.json')
    return new UserPersistence(primaryPath, writer)
  }

  afterEach(async () => {
    await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
  })

  test('persists non-empty data atomically and keeps the replaced profile as backup', async () => {
    const persistence = await createPersistence()
    await writeFile(persistence.primaryPath, JSON.stringify(users('old')))

    await expect(persistence.persist(users('new'), 'automatic')).resolves.toBe('saved')

    await expect(readFile(persistence.primaryPath, 'utf-8')).resolves.toContain('"new"')
    await expect(readFile(persistence.primaryPath, 'utf-8')).resolves.not.toContain('access-token-secret')
    await expect(readFile(persistence.backupPath, 'utf-8')).resolves.toContain('"old"')
    await expect(readFile(persistence.metadataPath, 'utf-8')).resolves.toContain('"not-empty"')
  })

  test('keeps the previous primary and backup valid when the replacement write is interrupted', async () => {
    let primaryPath = ''
    const interruptingWriter: AtomicFileWriter = async (path, content) => {
      if (path === primaryPath) throw new Error('simulated write interruption')
      const { writeFile: atomicWrite } = await import('atomically')
      await atomicWrite(path, content)
    }
    const persistence = await createPersistence(interruptingWriter)
    primaryPath = persistence.primaryPath
    await writeFile(primaryPath, JSON.stringify(users('old')))

    await expect(persistence.persist(users('new'), 'automatic')).rejects.toThrow('simulated write interruption')

    await expect(readFile(primaryPath, 'utf-8')).resolves.toContain('"old"')
    await expect(readFile(persistence.backupPath, 'utf-8')).resolves.toContain('"old"')
  })

  test('uses a valid backup in memory when the primary is malformed without rewriting it', async () => {
    const persistence = await createPersistence()
    await writeFile(persistence.primaryPath, '{ malformed')
    await writeFile(persistence.backupPath, JSON.stringify(users('backup')))
    await writeFile(persistence.metadataPath, JSON.stringify({ version: 1, emptyState: 'not-empty' }))

    await expect(persistence.load()).resolves.toMatchObject({
      source: 'backup',
      recoveredFromBackup: true,
      users: {
        users: {
          backup: {
            id: 'backup',
            username: 'backup@example.com',
          },
        },
      },
    })
    await expect(readFile(persistence.primaryPath, 'utf-8')).resolves.toBe('{ malformed')
    await expect(persistence.diagnoseRecovery()).resolves.toEqual({
      primary: 'missing-or-malformed',
      backup: 'valid-nonempty',
      explicitEmpty: false,
      recoveryAvailable: true,
    })
  })

  test('uses a backup when an empty primary has no intentional-empty marker', async () => {
    const persistence = await createPersistence()
    await writeFile(persistence.primaryPath, JSON.stringify({ users: {} }))
    await writeFile(persistence.backupPath, JSON.stringify(users('backup')))
    await writeFile(persistence.metadataPath, JSON.stringify({
      version: 1,
      emptyState: 'not-empty',
      contentHash: 'previous-nonempty-content',
    }))

    await expect(persistence.load()).resolves.toMatchObject({
      source: 'backup',
      recoveredFromBackup: true,
      users: {
        users: {
          backup: { id: 'backup' },
        },
      },
    })
  })

  test('does not let an automatic empty state erase a valid profile during initialization', async () => {
    const persistence = await createPersistence()
    await writeFile(persistence.primaryPath, JSON.stringify(users('existing')))

    await expect(persistence.persist({ users: {} }, 'automatic')).resolves.toBe('guarded')
    await expect(readFile(persistence.primaryPath, 'utf-8')).resolves.toContain('"existing"')
  })

  test('persists an explicitly intentional removal of the final user without restoring its backup', async () => {
    const persistence = await createPersistence()
    await writeFile(persistence.primaryPath, JSON.stringify(users('removed')))

    await expect(persistence.persist({ users: {} }, 'explicit-empty')).resolves.toBe('saved')
    await expect(persistence.load()).resolves.toEqual({
      users: { users: {} },
      source: 'primary',
      recoveredFromBackup: false,
    })
    await expect(readFile(persistence.backupPath, 'utf-8')).resolves.toContain('"removed"')
    await expect(persistence.diagnoseRecovery()).resolves.toMatchObject({
      explicitEmpty: true,
      recoveryAvailable: false,
    })
  })

  test('does not expose user profile or token data in persistence failure reporting', async () => {
    const persistence = await createPersistence(async () => {
      throw new Error('write failed')
    })
    const loggedMessages: string[] = []

    await persistence.persist(users('private-user'), 'automatic').catch(() => {
      loggedMessages.push('Failed to persist user profile changes.')
    })

    expect(loggedMessages).toEqual(['Failed to persist user profile changes.'])
    expect(JSON.stringify(loggedMessages)).not.toContain('private-user')
    expect(JSON.stringify(loggedMessages)).not.toContain('access-token-secret')
  })
})
