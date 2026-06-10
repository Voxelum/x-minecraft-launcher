import { describe, test, expect, vi } from 'vitest'
import { z } from 'zod'
import { launchInstanceCommand, LaunchInstanceInputSchema } from './launch'
import type { CommandContext } from '../types'
import { AuthlibInjectorServiceKey } from '../../services/AuthlibInjectorService'
import { BaseServiceKey } from '../../services/BaseService'
import { JavaServiceKey } from '../../services/JavaService'
import { LaunchServiceKey } from '../../services/LaunchService'
import { UserServiceKey } from '../../services/UserService'
import { VersionServiceKey } from '../../services/VersionService'

function makeInstance(overrides: Partial<any> = {}) {
  return {
    path: '/home/u/inst/foo',
    name: 'foo',
    runtime: { minecraft: '1.21.1', forge: '', fabricLoader: '', quiltLoader: '', neoForged: '', optifine: '', labyMod: '' },
    java: '',
    version: '',
    ...overrides,
  }
}

function makeUser(overrides: Partial<any> = {}) {
  return {
    id: 'u1',
    username: 'tester',
    authority: 'https://example.com',
    profiles: {},
    ...overrides,
  }
}

function makeSettings(overrides: Partial<any> = {}) {
  return {
    globalEnv: {},
    globalVmOptions: [],
    globalMcOptions: [],
    globalPrependCommand: '',
    globalAssignMemory: false,
    globalMinMemory: 0,
    globalMaxMemory: 0,
    globalHideLauncher: false,
    globalShowLog: false,
    globalFastLaunch: false,
    globalDisableAuthlibInjector: true, // skip authlib install in test
    globalDisableElyByAuthlib: false,
    globalPreExecuteCommand: '',
    ...overrides,
  }
}

function makeCtx(callImpl: (key: string, method: string, ...args: any[]) => any): CommandContext {
  const ctx: CommandContext = {
    mode: 'cli',
    signal: new AbortController().signal,
    call: vi.fn((key: any, method: any, ...args: any[]) => Promise.resolve(callImpl(String(key), String(method), ...args))) as any,
    state: vi.fn() as any,
    resolveInstance: vi.fn(async (ref: string) => makeInstance({ path: ref })) as any,
    resolveUser: vi.fn(async () => makeUser()) as any,
    pickInstance: vi.fn() as any,
    pickUser: vi.fn() as any,
    prompt: vi.fn() as any,
    confirm: vi.fn() as any,
    select: vi.fn() as any,
    task: ((_n: string, run: any) => run({ update: () => {}, child: () => ({} as any) })) as any,
    out: { log: vi.fn(), json: vi.fn(), table: vi.fn() },
  }
  return ctx
}

describe('LaunchInstanceInputSchema', () => {
  test('accepts minimal input and applies defaults', () => {
    const parsed = LaunchInstanceInputSchema.parse({ instance: '/p/i' })
    expect(parsed).toEqual({
      instance: '/p/i',
      side: 'client',
      modCount: 0,
      dry: false,
    })
  })

  test('validates server shape', () => {
    expect(() => LaunchInstanceInputSchema.parse({
      instance: '/p/i',
      server: { host: 'mc.example.com', port: 25565 },
    })).not.toThrow()
    expect(() => LaunchInstanceInputSchema.parse({
      instance: '/p/i',
      server: { host: '', port: 25565 },
    })).toThrow()
  })

  test('rejects empty instance ref', () => {
    expect(() => LaunchInstanceInputSchema.parse({ instance: '' })).toThrow()
  })
})

describe('launchInstanceCommand', () => {
  test('orchestrates services through ctx.call and returns the launch pid', async () => {
    const launchSpy = vi.fn(async () => 4242)
    const ctx = makeCtx((key, method) => {
      if (key === UserServiceKey && method === 'refreshUser') return makeUser()
      if (key === VersionServiceKey && method === 'getLocalVersions') return { local: [{ id: 'v1', minecraft: '1.21.1' }] }
      if (key === VersionServiceKey && method === 'resolveLocalVersion') return { id: 'v1', minecraftVersion: '1.21.1', libraries: [], pathChain: ['/v'] }
      if (key === JavaServiceKey && method === 'getJavaState') return { all: [{ path: '/java', valid: true, version: '21', majorVersion: 21, arch: 'x64' }] }
      if (key === JavaServiceKey && method === 'resolveJava') return { path: '/java', valid: true, version: '21', majorVersion: 21, arch: 'x64' }
      if (key === BaseServiceKey && method === 'getSettings') return makeSettings()
      if (key === AuthlibInjectorServiceKey && method === 'getOrInstallAuthlibInjector') return '/authlib.jar'
      if (key === LaunchServiceKey && method === 'launch') return launchSpy()
      throw new Error(`Unexpected ctx.call(${key}, ${method})`)
    })

    const pid = await launchInstanceCommand.handler(
      LaunchInstanceInputSchema.parse({ instance: '/inst/foo', user: 'u1', modCount: 5 }),
      ctx,
    )

    expect(pid).toBe(4242)
    expect(launchSpy).toHaveBeenCalledOnce()
    expect(ctx.resolveInstance).toHaveBeenCalledWith('/inst/foo')
    expect(ctx.resolveUser).toHaveBeenCalledWith('u1')
  })

  test('throws when no version matches the instance', async () => {
    const ctx = makeCtx((key, method) => {
      if (key === UserServiceKey && method === 'refreshUser') return makeUser()
      if (key === VersionServiceKey && method === 'getLocalVersions') return { local: [] }
      if (key === BaseServiceKey && method === 'getSettings') return makeSettings()
      throw new Error(`Unexpected ctx.call(${key}, ${method})`)
    })

    await expect(launchInstanceCommand.handler(
      LaunchInstanceInputSchema.parse({ instance: '/inst/foo' }),
      ctx,
    )).rejects.toThrow(/No local version matches/)
  })

  test('falls back to auto-detected Java when the pinned instance.java path is gone', async () => {
    // Bug #1 regression: when the user has pinned a Java path that no longer
    // resolves (uninstalled / moved), launch must NOT spawn with that broken
    // path. It should silently use the auto-detected Java instead.
    let spawnedJava: string | undefined
    const ctx = makeCtx((key, method, _arg) => {
      if (key === UserServiceKey && method === 'refreshUser') return makeUser()
      if (key === VersionServiceKey && method === 'getLocalVersions') return { local: [{ id: 'v1', minecraft: '1.21.1' }] }
      if (key === VersionServiceKey && method === 'resolveLocalVersion') return { id: 'v1', minecraftVersion: '1.21.1', libraries: [], pathChain: ['/v'] }
      if (key === JavaServiceKey && method === 'getJavaState') {
        return { all: [{ path: '/usr/local/jdk-21/bin/java', valid: true, version: '21', majorVersion: 21, arch: 'x64' }] }
      }
      if (key === JavaServiceKey && method === 'resolveJava') {
        // Pinned path no longer exists on disk.
        return undefined
      }
      if (key === BaseServiceKey && method === 'getSettings') return makeSettings()
      if (key === LaunchServiceKey && method === 'launch') {
        spawnedJava = (_arg as any)?.java
        return 9999
      }
      throw new Error(`Unexpected ctx.call(${key}, ${method})`)
    })

    // Pin a deleted path.
    ;(ctx.resolveInstance as any).mockImplementationOnce(async (ref: string) => makeInstance({
      path: ref,
      java: '/deleted/old-jdk/bin/java',
    }))

    const pid = await launchInstanceCommand.handler(
      LaunchInstanceInputSchema.parse({ instance: '/inst/foo' }),
      ctx,
    )

    expect(pid).toBe(9999)
    expect(spawnedJava).toBe('/usr/local/jdk-21/bin/java')
  })

  test('dry mode skips LaunchService.launch', async () => {
    const launchSpy = vi.fn()
    const ctx = makeCtx((key, method) => {
      if (key === UserServiceKey && method === 'refreshUser') return makeUser()
      if (key === VersionServiceKey && method === 'getLocalVersions') return { local: [{ id: 'v1', minecraft: '1.21.1' }] }
      if (key === VersionServiceKey && method === 'resolveLocalVersion') return { id: 'v1', minecraftVersion: '1.21.1', libraries: [], pathChain: ['/v'] }
      if (key === JavaServiceKey && method === 'getJavaState') return { all: [{ path: '/java', valid: true, version: '21', majorVersion: 21, arch: 'x64' }] }
      if (key === JavaServiceKey && method === 'resolveJava') return { path: '/java', valid: true, version: '21', majorVersion: 21, arch: 'x64' }
      if (key === BaseServiceKey && method === 'getSettings') return makeSettings()
      if (key === LaunchServiceKey && method === 'launch') { launchSpy(); return 0 }
      throw new Error(`Unexpected ctx.call(${key}, ${method})`)
    })

    const result = await launchInstanceCommand.handler(
      LaunchInstanceInputSchema.parse({ instance: '/inst/foo', dry: true }),
      ctx,
    )
    expect(result).toBeUndefined()
    expect(launchSpy).not.toHaveBeenCalled()
  })
})
