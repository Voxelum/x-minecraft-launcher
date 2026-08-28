import type { ResourceState, ResourceManager } from '@xmcl/resource'
import type { ModMetadataService, Settings, SharedState } from '@xmcl/runtime-api'
import { ensureDir, mkdtemp, pathExists, rm, unlink, writeFile } from 'fs-extra'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { InstanceModsService } from './InstanceModsService'

vi.mock('~/app', () => ({
  Inject: () => () => { },
  LauncherApp: class { },
  LauncherAppKey: Symbol('LauncherAppKey'),
  kGameDataPath: Symbol('kGameDataPath'),
}))

vi.mock('~/instance', () => ({
  InstanceService: class { },
}))

describe('InstanceModsService uninstall', () => {
  let instancePath: string
  let modPath: string
  let configPath: string

  beforeEach(async () => {
    instancePath = await mkdtemp(join(tmpdir(), 'xmcl-instance-mods-'))
    modPath = join(instancePath, 'mods', 'example.jar')
    configPath = join(instancePath, 'config', 'example.toml')
    await ensureDir(join(instancePath, 'mods'))
    await ensureDir(join(instancePath, 'config'))
    await writeFile(modPath, 'mod')
    await writeFile(configPath, 'config')
  })

  afterEach(async () => {
    await rm(instancePath, { recursive: true, force: true })
  })

  function createService(
    deleteModConfigsOnRemoval: boolean,
    metadataFailure = false,
    additionalFiles: ResourceState['files'] = [],
    mappings: Record<string, string[]> = { example: ['example.toml'] },
  ) {
    const state = {
      files: [{
        path: modPath,
        metadata: { fabric: { id: 'example' } },
      }, ...additionalFiles],
    } as unknown as SharedState<ResourceState>
    const app = {
      getLogger: () => ({ log: vi.fn(), warn: vi.fn(), error: vi.fn() }),
      registry: {
        get: metadataFailure
          ? vi.fn().mockRejectedValue(new Error('metadata unavailable'))
          : vi.fn().mockResolvedValue({ get: () => state, revalidate: vi.fn() }),
      },
    }
    const modMetadataService = {
      lookupModConfigPaths: vi.fn().mockResolvedValue(mappings),
    }
    const service = new InstanceModsService(
      app as any,
      {} as ResourceManager,
      { deleteModConfigsOnRemoval } as SharedState<Settings>,
      modMetadataService as unknown as ModMetadataService,
    )
    return { service, modMetadataService }
  }

  test('keeps mapped configs when cleanup is disabled', async () => {
    const { service, modMetadataService } = createService(false)

    await service.uninstall({ path: instancePath, files: [modPath] })

    expect(await pathExists(modPath)).toBe(false)
    expect(await pathExists(configPath)).toBe(true)
    expect(modMetadataService.lookupModConfigPaths).not.toHaveBeenCalled()
  })

  test('removes mapped configs when cleanup is enabled', async () => {
    const { service, modMetadataService } = createService(true)

    await service.uninstall({ path: instancePath, files: [modPath] })

    expect(await pathExists(modPath)).toBe(false)
    expect(await pathExists(configPath)).toBe(false)
    expect(modMetadataService.lookupModConfigPaths).toHaveBeenCalledWith(['example'])
  })

  test('still removes the mod when metadata lookup fails', async () => {
    const { service, modMetadataService } = createService(true, true)

    await service.uninstall({ path: instancePath, files: [modPath] })

    expect(await pathExists(modPath)).toBe(false)
    expect(await pathExists(configPath)).toBe(true)
    expect(modMetadataService.lookupModConfigPaths).not.toHaveBeenCalled()
  })

  test('keeps shared configs when another requested mod fails to uninstall', async () => {
    const survivingModPath = join(instancePath, 'mods', 'surviving.jar')
    const sharedConfigPath = join(instancePath, 'config', 'shared.toml')
    await writeFile(survivingModPath, 'mod')
    await writeFile(sharedConfigPath, 'shared')
    const { service } = createService(true, false, [{
      path: survivingModPath,
      metadata: { fabric: { id: 'surviving' } },
    }] as ResourceState['files'], {
      example: ['shared.toml'],
      surviving: ['shared.toml'],
    })
    ;(service as any).uninstallFiles = async () => {
      await unlink(modPath)
      return new Set([modPath])
    }

    await service.uninstall({ path: instancePath, files: [modPath, survivingModPath] })

    expect(await pathExists(modPath)).toBe(false)
    expect(await pathExists(survivingModPath)).toBe(true)
    expect(await pathExists(sharedConfigPath)).toBe(true)
  })
})
