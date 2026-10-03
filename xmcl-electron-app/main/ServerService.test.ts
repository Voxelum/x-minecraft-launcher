import type { InstallServerServiceOptions, LaunchOptions } from '@xmcl/runtime-api'
import type { LauncherApp } from '@xmcl/runtime/app'
import type { LaunchService } from '@xmcl/runtime/launch'
import type { RemoteServerService } from '@xmcl/runtime/remoteServer'
import { dirname, join, resolve } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ServerService } from './ServerService'

const mocks = vi.hoisted(() => ({
  files: new Map<string, string | Buffer>(),
  directories: new Set<string>(),
  realpath: vi.fn<(path: string) => Promise<string>>(),
  execFile: vi.fn<(
    file: string,
    args: string[],
    options: { windowsHide: boolean },
    callback: (error: Error | null, stdout: string, stderr: string) => void,
  ) => void>(),
  remove: vi.fn<(path: string) => Promise<void>>(),
  generateArguments: vi.fn<(options: LaunchOptions) => Promise<string[]>>(),
  fetch: vi.fn(),
  error: vi.fn(),
  remote: { startService: vi.fn(), installService: vi.fn() },
  hash: '05b82d46ad331cc16bdc00de5c6332c1ef818df8ceefcd49c726553209b3a0da',
}))

vi.mock('crypto', () => ({
  createHash: () => ({
    update: (data: string | Buffer) => ({
      digest: () => typeof data === 'string' ? 'instance-key' : mocks.hash,
    }),
  }),
}))
vi.mock('child_process', () => ({ execFile: mocks.execFile }))
vi.mock('fs/promises', () => ({ realpath: mocks.realpath }))
vi.mock('fs-extra', () => ({
  ensureDir: async (path: string) => { mocks.directories.add(path) },
  pathExists: async (path: string) => mocks.files.has(path),
  readFile: async (path: string) => {
    const data = mocks.files.get(path)
    if (data === undefined) throw Object.assign(new Error(`Missing ${path}`), { code: 'ENOENT' })
    return data
  },
  writeFile: async (path: string, data: string | Buffer) => { mocks.files.set(path, data) },
  rename: async (source: string, destination: string) => {
    const data = mocks.files.get(source)
    if (data === undefined) throw new Error(`Missing ${source}`)
    mocks.files.set(destination, data)
    mocks.files.delete(source)
  },
  remove: mocks.remove,
}))
vi.mock('@xmcl/runtime/app', () => ({
  Inject: () => () => {},
  LauncherAppKey: 'app',
}))
vi.mock('@xmcl/runtime/launch', () => ({ LaunchService: class {} }))
vi.mock('@xmcl/runtime/remoteServer', () => ({ RemoteServerService: class {} }))
vi.mock('@xmcl/runtime/service', () => ({
  AbstractService: class {
    constructor(readonly app: LauncherApp) {}
    error = mocks.error
  },
  ExposeServiceKey: () => (target: unknown) => target,
}))

const root = resolve('service-test', "User's \u6d4b\u8bd5 AppData")
const appDataPath = join(root, 'Roaming', 'xmcl')
const physicalRoot = resolve('service-test', "User's \u6d4b\u8bd5 LocalCache")
const instancePath = join(appDataPath, 'instances', 'Test server')
const winSW = join(appDataPath, 'server-services', 'WinSW-x64-v2.12.0.exe')
const configPath = join(appDataPath, 'server-services', 'instance-key', 'server-service.xml')
const java = join(appDataPath, 'jre', 'bin', 'java.exe')
const platform = Object.getOwnPropertyDescriptor(process, 'platform')!

function physical(path: string) {
  return path.replace(root, physicalRoot)
}

function quotePowerShell(value: string) {
  return `'${value.replaceAll("'", "''")}'`
}

function scripts() {
  return mocks.execFile.mock.calls.map(([file, args, options]) => {
    expect(file).toBe('powershell.exe')
    expect(options.windowsHide).toBe(true)
    expect(args.slice(0, 5)).toEqual(['-NoProfile', '-NonInteractive', '-OutputFormat', 'Text', '-EncodedCommand'])
    return Buffer.from(args[5], 'base64').toString('utf16le')
  })
}

function createService() {
  const app: Partial<LauncherApp> = { appDataPath, fetch: mocks.fetch }
  const launchService: Partial<LaunchService> = { generateArguments: mocks.generateArguments }
  const remoteServerService: Partial<RemoteServerService> = mocks.remote
  return new ServerService(
    app as LauncherApp,
    launchService as LaunchService,
    remoteServerService as RemoteServerService,
  )
}

function installOptions(): InstallServerServiceOptions {
  return {
    instancePath,
    target: 'local',
    name: 'xmcl-path-test',
    launchOptions: {
      version: '1.21.1',
      gameDirectory: instancePath,
      java,
      user: {
        id: '', username: '', invalidated: false, authority: '', expiredAt: -1, profiles: {}, selectedProfile: '',
      },
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
  mocks.files.clear()
  mocks.directories.clear()
  mocks.files.set(winSW, Buffer.from('verified WinSW fixture'))
  mocks.files.set(java, Buffer.from('Java fixture'))
  mocks.directories.add(instancePath)
  mocks.realpath.mockImplementation(async (path) => {
    if (!mocks.files.has(path) && !mocks.directories.has(path)) throw new Error(`Cannot resolve ${path}`)
    return physical(path)
  })
  mocks.execFile.mockImplementation((_file, _args, _options, callback) => callback(null, '', ''))
  mocks.remove.mockImplementation(async (path) => { mocks.files.delete(path) })
  mocks.generateArguments.mockImplementation(async (options) => ['-jar', join(options.gameDirectory, 'server.jar'), 'nogui'])
})

afterEach(() => {
  Object.defineProperty(process, 'platform', platform)
})

describe('Windows server service process boundaries', () => {
  it.each([true, false])('installs using physical paths (AppData redirected: %s)', async (redirected) => {
    const resolvePath = redirected ? physical : (path: string) => path
    if (!redirected) mocks.realpath.mockImplementation(async (path) => path)
    const options = installOptions()

    expect(await createService().install(options)).toEqual({ ok: true })

    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.generateArguments).toHaveBeenCalledWith({
      ...options.launchOptions,
      side: 'server',
      java: resolvePath(java),
      gameDirectory: resolvePath(instancePath),
    })
    expect(options.launchOptions?.gameDirectory).toBe(instancePath)
    const config = String(mocks.files.get(configPath))
    expect(config).toContain(`<executable>${resolvePath(java).replaceAll("'", '&apos;')}</executable>`)
    expect(config).toContain(`<workingdirectory>${resolvePath(join(instancePath, 'server')).replaceAll("'", '&apos;')}</workingdirectory>`)
    expect(config).toContain('NT AUTHORITY\\LocalService')

    const commands = scripts()
    expect(commands).toHaveLength(4)
    expect(commands[0]).toContain(quotePowerShell(`"${dirname(resolvePath(winSW))}" /grant *S-1-5-19:(OI)(CI)RX`))
    expect(commands[1]).toContain(quotePowerShell(`"${dirname(resolvePath(configPath))}" /grant *S-1-5-19:(OI)(CI)RX`))
    expect(commands[2]).toContain(quotePowerShell(`"${resolvePath(join(instancePath, 'server'))}" /grant *S-1-5-19:(OI)(CI)M`))
    expect(commands[3]).toContain(`$command = ${quotePowerShell(resolvePath(winSW))}`)
    expect(commands[3]).toContain(`$arguments = ${quotePowerShell(`install "${resolvePath(configPath)}"`)}`)
    for (const command of commands) {
      expect(command).toContain('-Verb RunAs -Wait -PassThru')
      expect(command).toContain('$ErrorActionPreference = \'Stop\'')
      expect(command).toContain('if ($child.ExitCode -ne 0) { throw')
    }
  })

  it('resolves newly downloaded WinSW only after the final executable exists', async () => {
    mocks.files.delete(winSW)
    mocks.fetch.mockResolvedValue({ ok: true, arrayBuffer: async () => Buffer.from('downloaded WinSW') })

    expect(await createService().install(installOptions())).toEqual({ ok: true })

    expect(mocks.fetch).toHaveBeenCalledOnce()
    expect(mocks.files.has(winSW)).toBe(true)
    expect(mocks.realpath).toHaveBeenCalledWith(winSW)
    expect(scripts().at(-1)).toContain(`$command = ${quotePowerShell(physical(winSW))}`)
  })

  it.each(['start', 'stop', 'restart', 'uninstall'] as const)('resolves both cached paths before %s', async (action) => {
    mocks.files.set(configPath, '<service><id>xmcl-path-test</id></service>')

    expect(await createService()[action](instancePath, 'local')).toEqual({ ok: true })

    expect(scripts()).toHaveLength(1)
    expect(scripts()[0]).toContain(`$command = ${quotePowerShell(physical(winSW))}`)
    expect(scripts()[0]).toContain(`$arguments = ${quotePowerShell(`${action} "${physical(configPath)}"`)}`)
    if (action === 'uninstall') expect(mocks.remove).toHaveBeenCalledWith(dirname(configPath))
  })

  it('resolves the old configuration when changing the service name', async () => {
    mocks.files.set(configPath, '<service><id>old-service</id></service>')

    expect(await createService().install(installOptions())).toEqual({ ok: true })

    expect(scripts()[0]).toContain(`$arguments = ${quotePowerShell(`uninstall "${physical(configPath)}"`)}`)
    expect(scripts().at(-1)).toContain(`$arguments = ${quotePowerShell(`install "${physical(configPath)}"`)}`)
  })

  it('waits for ACL completion and aborts installation when the elevated command fails', async () => {
    let complete: ((error: Error | null, stdout: string, stderr: string) => void) | undefined
    mocks.execFile.mockImplementationOnce((_file, _args, _options, callback) => { complete = callback })
    const result = createService().install(installOptions())
    await vi.waitFor(() => expect(complete).toBeDefined())
    expect(mocks.execFile).toHaveBeenCalledOnce()
    complete!(new Error('Command failed'), '', 'icacls.exe failed with exit code 5.')

    expect(await result).toEqual({
      ok: false,
      message: 'Failed to run icacls.exe ' + physical(dirname(winSW)) + ': icacls.exe failed with exit code 5.',
    })
    expect(mocks.execFile).toHaveBeenCalledOnce()
    expect(mocks.error).toHaveBeenCalledOnce()
  })

  it('keeps configuration when elevated uninstall fails or UAC is cancelled', async () => {
    mocks.files.set(configPath, '<service><id>xmcl-path-test</id></service>')
    mocks.execFile.mockImplementationOnce((_file, _args, _options, callback) => callback(new Error('Command failed'), '', 'The operation was canceled by the user.'))

    expect(await createService().uninstall(instancePath, 'local')).toMatchObject({
      ok: false,
      message: expect.stringContaining('The operation was canceled by the user.'),
    })
    expect(mocks.remove).not.toHaveBeenCalled()
    expect(mocks.error).toHaveBeenCalledOnce()
  })

  it.skipIf(platform.value !== 'win32').each([0, 5])('executes the PowerShell wrapper with child exit code %s', async (exitCode) => {
    mocks.files.set(configPath, '<service><id>xmcl-path-test</id></service>')
    await createService().start(instancePath, 'local')
    const script = scripts()[0]
    // Shadow only the UAC boundary: parse and execute the real wrapper without
    // requesting administrator rights or changing any installed services.
    const stub = [
      'function Start-Process {',
      '  param($FilePath, $ArgumentList, $WorkingDirectory, $Verb, [switch]$Wait, [switch]$PassThru, $WindowStyle)',
      '  [Console]::WriteLine((@{ File = $FilePath; Arguments = $ArgumentList; Verb = $Verb; Wait = [bool]$Wait; PassThru = [bool]$PassThru } | ConvertTo-Json -Compress))',
      `  [pscustomobject]@{ ExitCode = ${exitCode} }`,
      '}',
    ].join('\n')
    const { spawnSync } = await vi.importActual<typeof import('child_process')>('child_process')
    const args = mocks.execFile.mock.calls[0][1]
    const result = spawnSync('powershell.exe', [
      ...args.slice(0, -1), Buffer.from(`${stub}\n${script}`, 'utf16le').toString('base64'),
    ], { encoding: 'utf8', windowsHide: true })

    expect(result.error).toBeUndefined()
    expect(JSON.parse(result.stdout)).toEqual({
      File: physical(winSW),
      Arguments: `start "${physical(configPath)}"`,
      Verb: 'RunAs',
      Wait: true,
      PassThru: true,
    })
    expect(result.status).toBe(exitCode === 0 ? 0 : 1)
    if (exitCode !== 0) {
      expect(result.stderr).toContain('failed with exit code 5.')
      expect(result.stderr).not.toContain('CLIXML')
      expect(result.stderr).not.toContain('\ufffd')
    }
  })

  it('reports an unresolved physical path without starting an elevated command', async () => {
    mocks.files.set(configPath, '<service><id>xmcl-path-test</id></service>')
    mocks.realpath.mockRejectedValueOnce(new Error('WinSW is missing'))

    expect(await createService().start(instancePath, 'local')).toEqual({ ok: false, message: 'WinSW is missing' })
    expect(mocks.execFile).not.toHaveBeenCalled()
    expect(mocks.error).toHaveBeenCalledOnce()
  })

  it('leaves remote service delegation unchanged', async () => {
    mocks.remote.startService.mockResolvedValue({ ok: true })
    mocks.remote.installService.mockResolvedValue({ ok: true })
    const service = createService()

    expect(await service.start(instancePath, 'remote')).toEqual({ ok: true })
    expect(await service.install({ ...installOptions(), target: 'remote' })).toEqual({ ok: true })
    expect(mocks.remote.startService).toHaveBeenCalledWith(instancePath)
    expect(mocks.remote.installService).toHaveBeenCalledWith(instancePath)
    expect(mocks.realpath).not.toHaveBeenCalled()
    expect(mocks.execFile).not.toHaveBeenCalled()
  })
})
