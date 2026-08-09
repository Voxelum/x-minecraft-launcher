import { describe, test, expect, vi } from 'vitest'
import { assertInstallable, installResource, MarketRefInputSchema } from './installResource'
import { InstanceModsServiceKey } from '../../services/InstanceModsService'
import { InstanceInstallServiceKey } from '../../services/InstanceInstallService'
import type { CommandContext } from '../types'

function makeCtx(callImpl: (key: string, method: string, ...args: any[]) => any): CommandContext {
  return {
    mode: 'cli',
    signal: new AbortController().signal,
    call: vi.fn((key: any, method: any, ...args: any[]) => Promise.resolve(callImpl(String(key), String(method), ...args))) as any,
    state: vi.fn() as any,
    resolveInstance: vi.fn() as any,
    resolveUser: vi.fn() as any,
    pickInstance: vi.fn() as any,
    pickUser: vi.fn() as any,
    prompt: vi.fn() as any,
    confirm: vi.fn() as any,
    select: vi.fn() as any,
    task: ((_n: string, run: any) => run({ update: () => {}, child: () => ({} as any) })) as any,
    out: { log: vi.fn(), json: vi.fn(), table: vi.fn() },
  }
}

describe('MarketRefInputSchema', () => {
  test('coerces string forms', () => {
    expect(MarketRefInputSchema.parse('modrinth:fabric-api@1.0')).toEqual({ source: 'modrinth', project: 'fabric-api', version: '1.0' })
    expect(MarketRefInputSchema.parse('curseforge:1/2')).toEqual({ source: 'curseforge', project: 1, file: 2 })
    expect(MarketRefInputSchema.parse('./local.jar')).toEqual({ source: 'file', path: './local.jar' })
  })

  test('passes through object form', () => {
    expect(MarketRefInputSchema.parse({ source: 'modrinth', project: 'sodium' }))
      .toEqual({ source: 'modrinth', project: 'sodium' })
  })
})

describe('assertInstallable', () => {
  test('rejects modrinth without version', () => {
    expect(() => assertInstallable({ source: 'modrinth', project: 'sodium' })).toThrow(/version/)
  })

  test('rejects curseforge without file', () => {
    expect(() => assertInstallable({ source: 'curseforge', project: 1 })).toThrow(/fileId/)
  })

  test('accepts complete refs', () => {
    expect(() => assertInstallable({ source: 'modrinth', project: 'sodium', version: '1' })).not.toThrow()
    expect(() => assertInstallable({ source: 'curseforge', project: 1, file: 2 })).not.toThrow()
    expect(() => assertInstallable({ source: 'file', path: '/a' })).not.toThrow()
    expect(() => assertInstallable({ source: 'url', url: 'https://x' })).not.toThrow()
  })
})

describe('installResource', () => {
  test('modrinth ref → resolve and stage with Modrinth shape', async () => {
    const files = [{ path: 'mods/x.jar' }]
    const ctx = makeCtx((_key, method) => method === 'resolveFromMarket' ? files : undefined)
    const result = await installResource(ctx, InstanceModsServiceKey, '/i', { source: 'modrinth', project: 'fabric-api', version: '0.105' })

    expect(ctx.call).toHaveBeenNthCalledWith(1, InstanceModsServiceKey, 'resolveFromMarket', {
      market: 0,
      version: { versionId: '0.105' },
      instancePath: '/i',
    })
    expect(ctx.call).toHaveBeenNthCalledWith(2, InstanceInstallServiceKey, 'stageInstanceFiles', {
      path: '/i',
      oldFiles: [],
      files,
    })
    expect(result).toEqual(['mods/x.jar'])
  })

  test('curseforge ref → resolve and stage with CurseForge shape', async () => {
    const files = [{ path: 'mods/y.jar' }]
    const ctx = makeCtx((_key, method) => method === 'resolveFromMarket' ? files : undefined)
    const result = await installResource(ctx, InstanceModsServiceKey, '/i', { source: 'curseforge', project: 1, file: 999 })

    expect(ctx.call).toHaveBeenNthCalledWith(1, InstanceModsServiceKey, 'resolveFromMarket', {
      market: 1,
      file: { fileId: 999 },
      instancePath: '/i',
    })
    expect(ctx.call).toHaveBeenNthCalledWith(2, InstanceInstallServiceKey, 'stageInstanceFiles', {
      path: '/i',
      oldFiles: [],
      files,
    })
    expect(result).toEqual(['mods/y.jar'])
  })

  test('file ref → resolve and stage a local path', async () => {
    const files = [{ path: 'mods/local.jar' }]
    const ctx = makeCtx((_key, method) => method === 'resolveFiles' ? files : undefined)
    const result = await installResource(ctx, InstanceModsServiceKey, '/i', { source: 'file', path: './local.jar' })

    expect(ctx.call).toHaveBeenNthCalledWith(1, InstanceModsServiceKey, 'resolveFiles', {
      path: '/i',
      files: ['./local.jar'],
    })
    expect(ctx.call).toHaveBeenNthCalledWith(2, InstanceInstallServiceKey, 'stageInstanceFiles', {
      path: '/i',
      oldFiles: [],
      files,
    })
    expect(result).toEqual(['mods/local.jar'])
  })

  test('url ref throws (not yet supported)', async () => {
    const ctx = makeCtx(() => undefined)
    await expect(installResource(ctx, InstanceModsServiceKey, '/i', { source: 'url', url: 'https://x' }))
      .rejects.toThrow(/URL/)
  })
})
