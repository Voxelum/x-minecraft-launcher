import { JavaState } from '@xmcl/runtime-api'
import { resolveJava, scanLocalJava } from '@xmcl/installer'
import { remove } from 'fs-extra'
import { join } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('~/app', () => ({
  Inject: () => () => {},
  LauncherAppKey: Symbol('LauncherAppKey'),
  kGameDataPath: Symbol('kGameDataPath'),
}))
vi.mock('~/service', () => ({
  ExposeServiceKey: () => () => {},
  Singleton: () => () => {},
  StatefulService: class {},
  ServiceStateManager: class {},
}))
vi.mock('~/java', () => ({
  JavaValidation: { Okay: 0, NotExisted: 1, NoPermission: 2 },
  detectLibc: vi.fn(),
  detectExecutableLibc: vi.fn(),
  getJavaExeFilePath: vi.fn(),
  validateJavaPath: vi.fn(),
}))
vi.mock('@xmcl/installer', () => ({
  resolveJava: vi.fn(),
  scanLocalJava: vi.fn(),
  parseJavaVersion: vi.fn(),
}))
vi.mock('fs-extra', () => ({
  stat: vi.fn(async () => ({ ino: 1 })),
  readFile: vi.fn(),
  readJson: vi.fn(),
  writeJson: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('../util/fs', () => ({ readdirIfPresent: vi.fn(async () => []) }))
vi.mock('./detectJVMArch', () => ({
  ensureClass: vi.fn(),
  getJavaArch: vi.fn(async () => 'x64'),
}))
vi.mock('./javaPaths', () => ({
  getAdoptiumJavaPaths: vi.fn(async () => [
    'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.20.101-hotspot\\bin\\java.exe',
  ]),
  getMojangJavaPaths: vi.fn(async () => []),
  getOrcaleJavaPaths: vi.fn(async () => []),
  getOpenJdkPaths: vi.fn(async () => []),
  getZuluJdkPath: vi.fn(async () => []),
  getJavaPathsLinux: vi.fn(async () => []),
  getJavaPathsLinuxSDK: vi.fn(async () => []),
  getJavaPathsOSX: vi.fn(async () => []),
}))

const { JavaService } = await import('./JavaService')

describe('JavaService discovery', () => {
  const java17 = {
    path: 'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.20.101-hotspot\\bin\\java.exe',
    version: '17.0.20',
    majorVersion: 17,
  }
  const cached = {
    path: 'C:\\custom-java\\bin\\java.exe',
    version: '25',
    majorVersion: 25,
    valid: true,
  }
  let service: InstanceType<typeof JavaService>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(scanLocalJava).mockResolvedValue([java17])
    vi.mocked(resolveJava).mockResolvedValue(cached)
    service = Object.assign(Object.create(JavaService.prototype), {
      state: new JavaState(),
      app: { platform: { os: 'windows' } },
      getPath: () => 'C:\\xmcl\\jre',
      log: vi.fn(),
    })
  })

  it.each([false, true])(
    'discovers Adoptium while preserving cached custom Java (force=%s)',
    async (force) => {
      service.state.javaUpdate(cached)
      await service.refreshLocalJava(force)
      expect(scanLocalJava).toHaveBeenCalledWith([java17.path])
      expect(service.state.all).toEqual([
        expect.objectContaining(cached),
        { ...java17, valid: true, arch: 'x64' },
      ])
      expect(resolveJava).toHaveBeenCalledTimes(force ? 0 : 1)
    },
  )

  it('discovers Adoptium without an existing Java cache', async () => {
    await service.refreshLocalJava()
    expect(service.state.all).toEqual([{ ...java17, valid: true, arch: 'x64' }])
  })

  it('uninstalls only Java runtimes contained within the managed directory', async () => {
    const root = '/tmp/xmcl/jre'
    service = Object.assign(service, { getPath: () => root })

    await service.removeJava(join(root, 'managed-runtime', 'bin', 'java'), true)
    expect(remove).toHaveBeenCalledWith(join(root, 'managed-runtime'))

    vi.mocked(remove).mockClear()
    await service.removeJava(join(root + '-backup', 'bin', 'java'), true)
    expect(remove).not.toHaveBeenCalled()
  })

  it('keeps the Java entry when uninstalling its runtime fails', async () => {
    const root = '/tmp/xmcl/jre'
    const javaPath = join(root, 'managed-runtime', 'bin', 'java')
    service = Object.assign(service, { getPath: () => root })
    service.state.javaUpdate({ path: javaPath, version: '21', majorVersion: 21, valid: true })
    vi.mocked(remove).mockRejectedValueOnce(new Error('permission denied'))

    await expect(service.removeJava(javaPath, true)).rejects.toThrow('permission denied')
    expect(service.state.all).toContainEqual(
      expect.objectContaining({ path: javaPath, valid: true }),
    )
  })
})
