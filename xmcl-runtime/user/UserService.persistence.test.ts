import { afterEach, describe, expect, test, vi } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { AUTHORITY_DEV, UserState } from '@xmcl/runtime-api'
import { kGameDataPath } from '~/app'
import { UserService } from './UserService'
import { kUserTokenStorage } from './userTokenStore'

vi.mock('~/app', () => ({
  LauncherApp: class LauncherApp {},
  Inject: () => () => undefined,
  LauncherAppKey: Symbol('LauncherAppKey'),
  kGameDataPath: Symbol('kGameDataPath'),
}))

describe('UserService user persistence', () => {
  const directories: string[] = []

  afterEach(async () => {
    vi.useRealTimers()
    await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
  })

  test('does not resolve user-specific dependencies during construction', async () => {
    const directory = await mkdtemp(join(process.cwd(), '.test-user-service-'))
    directories.push(directory)

    const state = new UserState() as UserState & { subscribeAll(callback: () => void): void }
    state.subscribeAll = vi.fn()
    const app = {
      appDataPath: directory,
      minecraftDataPath: directory,
      getLogger: vi.fn(() => ({ log: vi.fn(), warn: vi.fn(), error: vi.fn() })),
      controller: { broadcast: vi.fn() },
      registry: { get: vi.fn(), getOrCreate: vi.fn() },
      registryDisposer: vi.fn(),
      mutex: { of: vi.fn() },
    } as any

    new UserService(app, { registerStatic: vi.fn(() => state) } as any)

    expect(app.registry.get).not.toHaveBeenCalled()
    expect(app.registry.getOrCreate).not.toHaveBeenCalled()
  })

  test('does not allow startup cleanup to overwrite a loaded profile with an automatic empty state', async () => {
    vi.useFakeTimers()
    const directory = await mkdtemp(join(process.cwd(), '.test-user-service-'))
    directories.push(directory)
    const userJsonPath = join(directory, 'user.json')
    await writeFile(userJsonPath, JSON.stringify({
      users: {
        legacy: {
          id: 'legacy',
          username: '',
          invalidated: false,
          authority: 'https://auth.example.com',
          expiredAt: 0,
          profiles: {},
          selectedProfile: '',
        },
      },
    }))

    let subscriber: (() => void) | undefined
    const state = new UserState() as UserState & { subscribeAll(callback: () => void): void }
    const userData = state.userData.bind(state)
    const userProfileRemove = state.userProfileRemove.bind(state)
    state.subscribeAll = callback => { subscriber = callback }
    state.userData = data => {
      userData(data)
      subscriber?.()
    }
    state.userProfileRemove = id => {
      userProfileRemove(id)
      subscriber?.()
    }

    const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() }
    const tokenStorage = { get: vi.fn(), put: vi.fn() }
    const app = {
      appDataPath: directory,
      minecraftDataPath: directory,
      getLogger: vi.fn(() => logger),
      controller: { broadcast: vi.fn() },
      registry: {
        get: vi.fn((key: unknown) => Promise.resolve(key === kUserTokenStorage ? tokenStorage : () => directory)),
      },
      registryDisposer: vi.fn(),
      mutex: { of: vi.fn() },
    } as any
    const store = { registerStatic: vi.fn(() => state) } as any
    const service = new UserService(app, store)

    await service.getUserState()
    await vi.advanceTimersByTimeAsync(1_000)
    await (service as any).persistenceQueue

    await expect(readFile(userJsonPath, 'utf-8')).resolves.toContain('"legacy"')
    expect(logger.warn).not.toHaveBeenCalled()
  })

  test('writes an explicit empty marker when the final user is removed', async () => {
    vi.useFakeTimers()
    const directory = await mkdtemp(join(process.cwd(), '.test-user-service-'))
    directories.push(directory)
    const userJsonPath = join(directory, 'user.json')

    let subscriber: (() => void) | undefined
    const state = new UserState() as UserState & { subscribeAll(callback: () => void): void }
    const userData = state.userData.bind(state)
    const userProfileRemove = state.userProfileRemove.bind(state)
    state.subscribeAll = callback => { subscriber = callback }
    state.userData = data => {
      userData(data)
      subscriber?.()
    }
    state.userProfileRemove = id => {
      userProfileRemove(id)
      subscriber?.()
    }

    const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() }
    const app = {
      appDataPath: directory,
      minecraftDataPath: directory,
      getLogger: vi.fn(() => logger),
      controller: { broadcast: vi.fn() },
      registry: { get: vi.fn() },
      registryDisposer: vi.fn(),
      mutex: { of: vi.fn() },
    } as any
    const service = new UserService(app, { registerStatic: vi.fn(() => state) } as any)
    ;(service as any).persistenceReady = true

    state.userData({
      users: {
        final: {
          id: 'final',
          username: 'final@example.com',
          invalidated: false,
          authority: 'https://auth.example.com',
          expiredAt: 0,
          profiles: {},
          selectedProfile: '',
        },
      },
    })
    await service.removeUser(state.users.final)
    await vi.advanceTimersByTimeAsync(1_000)
    await (service as any).persistenceQueue

    await expect(readFile(userJsonPath, 'utf-8')).resolves.toContain('"users": {}')
    await expect(readFile(`${userJsonPath}.meta`, 'utf-8')).resolves.toContain('"intentional"')
  })

  test('logs a generic message when persistence fails without exposing a token', async () => {
    vi.useFakeTimers()
    const directory = await mkdtemp(join(process.cwd(), '.test-user-service-'))
    directories.push(directory)

    let subscriber: (() => void) | undefined
    const state = new UserState() as UserState & { subscribeAll(callback: () => void): void }
    const userData = state.userData.bind(state)
    state.subscribeAll = callback => { subscriber = callback }
    state.userData = data => {
      userData(data)
      subscriber?.()
    }

    const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() }
    const app = {
      appDataPath: directory,
      minecraftDataPath: directory,
      getLogger: vi.fn(() => logger),
      controller: { broadcast: vi.fn() },
      registry: { get: vi.fn() },
      registryDisposer: vi.fn(),
      mutex: { of: vi.fn() },
    } as any
    const service = new UserService(app, { registerStatic: vi.fn(() => state) } as any)
    ;(service as any).persistenceReady = true
    ;(service as any).userPersistence = {
      persist: vi.fn().mockRejectedValue(new Error('access-token-secret')),
    }

    const unsafeProfile = {
      id: 'private',
      username: 'private@example.com',
      invalidated: false,
      authority: 'https://auth.example.com',
      expiredAt: 0,
      profiles: {},
      selectedProfile: '',
      accessToken: 'access-token-secret',
    }
    state.userData({ users: { private: unsafeProfile as any } })
    await vi.advanceTimersByTimeAsync(1_000)
    await (service as any).persistenceQueue

    expect(logger.warn).toHaveBeenCalledWith('Failed to persist user profile changes.')
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('access-token-secret')
  })

  test('exposes persisted users before startup refresh completes', async () => {
    const directory = await mkdtemp(join(process.cwd(), '.test-user-service-'))
    directories.push(directory)
    const userJsonPath = join(directory, 'user.json')
    await writeFile(userJsonPath, JSON.stringify({
      users: {
        offline: {
          id: 'offline',
          username: 'offline',
          invalidated: false,
          authority: AUTHORITY_DEV,
          expiredAt: Date.now() + 60_000,
          profiles: {},
          selectedProfile: '',
        },
      },
    }))

    const state = new UserState() as UserState & { subscribeAll(callback: () => void): void }
    state.subscribeAll = vi.fn()
    const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() }
    const tokenStorage = { get: vi.fn(), put: vi.fn() }
    const app = {
      appDataPath: directory,
      minecraftDataPath: directory,
      getLogger: vi.fn(() => logger),
      controller: { broadcast: vi.fn() },
      registry: {
        get: vi.fn((key: unknown) => {
          if (key === kUserTokenStorage) return Promise.resolve(tokenStorage)
          if (key === kGameDataPath) return Promise.resolve(() => directory)
          return Promise.reject(new Error('Unexpected registry key'))
        }),
      },
      registryDisposer: vi.fn(),
      mutex: { of: vi.fn() },
    } as any
    const service = new UserService(app, { registerStatic: vi.fn(() => state) } as any)
    service.registerAccountSystem(AUTHORITY_DEV, {
      refresh: vi.fn(() => new Promise(() => undefined)),
    } as any)

    const sharedState = await service.getUserState()
    expect(Object.values(sharedState.users)).toContainEqual(expect.objectContaining({
      username: 'offline',
    }))
  })
})
