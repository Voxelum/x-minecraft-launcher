import { createHash } from 'crypto'
import { execFile } from 'child_process'
import { ensureDir, pathExists, readFile, remove, rename, writeFile } from 'fs-extra'
import { join } from 'path'
import {
  ServerServiceKey,
  type InstallServerServiceOptions,
  type ServerService as IServerService,
  type ServerServiceActionResult,
  type ServerServiceStatus,
  type ServerServiceTarget,
} from '@xmcl/runtime-api'
import { Inject, LauncherAppKey, type LauncherApp } from '@xmcl/runtime/app'
import { LaunchService } from '@xmcl/runtime/launch'
import { RemoteServerService } from '@xmcl/runtime/remoteServer'
import { AbstractService, ExposeServiceKey } from '@xmcl/runtime/service'
import { ensureElevateExe } from './utils/elevate'

const WINSW_VERSION = '2.12.0'
const WINSW_URL = `https://github.com/winsw/winsw/releases/download/v${WINSW_VERSION}/WinSW-x64.exe`
const WINSW_SHA256 = '05b82d46ad331cc16bdc00de5c6332c1ef818df8ceefcd49c726553209b3a0da'

function run(file: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    execFile(file, args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        Object.assign(error, { stdout, stderr })
        reject(error)
      } else {
        resolve({ stdout, stderr })
      }
    })
  })
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function quoteWindowsArgument(value: string) {
  if (value.length === 0) return '""'
  if (!/[\s"]/u.test(value)) return value
  return `"${value.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, '$1$1')}"`
}

function validateServiceName(name: string) {
  if (!/^[A-Za-z0-9_.-]{1,128}$/.test(name)) {
    throw new Error('The service name may only contain letters, numbers, dot, underscore, and hyphen.')
  }
}

@ExposeServiceKey(ServerServiceKey)
export class ServerService extends AbstractService implements IServerService {
  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(LaunchService) private launchService: LaunchService,
    @Inject(RemoteServerService) private remoteServerService: RemoteServerService,
  ) {
    super(app)
  }

  #serviceDirectory(instancePath: string) {
    const key = createHash('sha256').update(instancePath).digest('hex').slice(0, 24)
    return join(this.app.appDataPath, 'server-services', key)
  }

  #serviceConfigPath(instancePath: string) {
    return join(this.#serviceDirectory(instancePath), 'server-service.xml')
  }

  async #ensureWinSW() {
    const directory = join(this.app.appDataPath, 'server-services')
    const destination = join(directory, `WinSW-x64-v${WINSW_VERSION}.exe`)
    const valid = await readFile(destination)
      .then(data => createHash('sha256').update(data).digest('hex') === WINSW_SHA256)
      .catch(() => false)
    if (valid) return destination

    await ensureDir(directory)
    const response = await this.app.fetch(WINSW_URL)
    if (!response.ok) throw new Error(`Failed to download WinSW: HTTP ${response.status}`)
    const data = Buffer.from(await response.arrayBuffer())
    const actual = createHash('sha256').update(data).digest('hex')
    if (actual !== WINSW_SHA256) throw new Error('Downloaded WinSW failed its SHA-256 integrity check.')

    const temporary = `${destination}.tmp-${process.pid}`
    await writeFile(temporary, data)
    await remove(destination).catch(() => undefined)
    await rename(temporary, destination)
    return destination
  }

  async #runElevated(file: string, args: string[]) {
    const elevate = await ensureElevateExe(this.app.appDataPath)
    return run(elevate, [file, ...args])
  }

  async #getLocalStatus(instancePath: string): Promise<ServerServiceStatus> {
    if (process.platform !== 'win32') {
      return { supported: false, installed: false, active: false }
    }
    const config = await readFile(this.#serviceConfigPath(instancePath), 'utf8').catch(() => '')
    const name = config.match(/<id>([^<]+)<\/id>/)?.[1]
    if (!name) {
      return {
        supported: true,
        manager: 'windows-service',
        installed: false,
        active: false,
        requiresElevation: true,
      }
    }
    try {
      const { stdout } = await run('sc.exe', ['queryex', name])
      const state = stdout.match(/STATE\s*:\s*\d+\s+(\w+)/)?.[1]
      const pid = Number(stdout.match(/PID\s*:\s*(\d+)/)?.[1])
      return {
        supported: true,
        manager: 'windows-service',
        installed: true,
        active: state === 'RUNNING' || state === 'START_PENDING',
        pid: Number.isFinite(pid) && pid > 0 ? pid : undefined,
        requiresElevation: true,
      }
    } catch (error) {
      const output = `${(error as { stdout?: string }).stdout ?? ''}\n${(error as { stderr?: string }).stderr ?? ''}`
      if (/1060|does not exist as an installed service/i.test(output)) {
        return {
          supported: true,
          manager: 'windows-service',
          installed: false,
          active: false,
          requiresElevation: true,
        }
      }
      return {
        supported: true,
        manager: 'windows-service',
        installed: false,
        active: false,
        requiresElevation: true,
        error: (error as Error).message,
      }
    }
  }

  async getStatus(instancePath: string, target: ServerServiceTarget): Promise<ServerServiceStatus> {
    if (target === 'local') return this.#getLocalStatus(instancePath)
    const status = await this.remoteServerService.getStatus(instancePath)
    return {
      supported: status.connected && status.platform === 'Linux' && status.systemdAvailable === true,
      manager: 'systemd-user',
      installed: status.serviceInstalled === true,
      active: status.serviceActive === true,
      pid: status.pid,
      requiresElevation: false,
      error: status.error,
    }
  }

  async install(options: InstallServerServiceOptions): Promise<ServerServiceActionResult> {
    if (options.target === 'remote') return this.remoteServerService.installService(options.instancePath)
    if (process.platform !== 'win32') return { ok: false, message: 'Local OS service management is only supported on Windows.' }
    if (!options.launchOptions) return { ok: false, message: 'Local launch options are required to install the service.' }

    try {
      validateServiceName(options.name)
      const serviceDirectory = this.#serviceDirectory(options.instancePath)
      const configPath = this.#serviceConfigPath(options.instancePath)
      const serverDirectory = join(options.instancePath, 'server')
      const winSW = await this.#ensureWinSW()
      const previousConfig = await readFile(configPath, 'utf8').catch(() => '')
      const previousName = previousConfig.match(/<id>([^<]+)<\/id>/)?.[1]
      if (previousName && previousName !== options.name) {
        await this.#runElevated(winSW, ['uninstall', configPath])
      }
      const launchOptions = { ...options.launchOptions, side: 'server' as const }
      const args = await this.launchService.generateArguments(launchOptions)
      await ensureDir(serviceDirectory)
      await ensureDir(serverDirectory)

      const config = [
        '<service>',
        `  <id>${escapeXml(options.name)}</id>`,
        `  <name>${escapeXml(`XMCL Minecraft Server - ${options.name}`)}</name>`,
        '  <description>Minecraft dedicated server managed by X Minecraft Launcher.</description>',
        `  <executable>${escapeXml(launchOptions.java)}</executable>`,
        `  <arguments>${escapeXml(args.map(quoteWindowsArgument).join(' '))}</arguments>`,
        `  <workingdirectory>${escapeXml(serverDirectory)}</workingdirectory>`,
        `  <logpath>${escapeXml(join(serverDirectory, 'logs'))}</logpath>`,
        '  <log mode="roll-by-size-time">',
        '    <sizeThreshold>10240</sizeThreshold>',
        '    <keepFiles>8</keepFiles>',
        '  </log>',
        '  <startmode>Automatic</startmode>',
        '  <stoptimeout>60sec</stoptimeout>',
        '  <onfailure action="restart" delay="5 sec" />',
        '  <serviceaccount>',
        '    <username>NT AUTHORITY\\LocalService</username>',
        '  </serviceaccount>',
        '</service>',
        '',
      ].join('\n')
      await writeFile(configPath, config, 'utf8')

      await this.#runElevated('icacls.exe', [join(this.app.appDataPath, 'server-services'), '/grant', '*S-1-5-19:(OI)(CI)RX'])
      await this.#runElevated('icacls.exe', [serverDirectory, '/grant', '*S-1-5-19:(OI)(CI)M'])
      await this.#runElevated(winSW, ['install', configPath])
      return { ok: true }
    } catch (error) {
      return { ok: false, message: (error as Error).message }
    }
  }

  async uninstall(instancePath: string, target: ServerServiceTarget): Promise<ServerServiceActionResult> {
    if (target === 'remote') return this.remoteServerService.uninstallService(instancePath)
    try {
      const configPath = this.#serviceConfigPath(instancePath)
      if (!await pathExists(configPath)) return { ok: true }
      const winSW = await this.#ensureWinSW()
      await this.#runElevated(winSW, ['uninstall', configPath])
      await remove(this.#serviceDirectory(instancePath))
      return { ok: true }
    } catch (error) {
      return { ok: false, message: (error as Error).message }
    }
  }

  async #control(instancePath: string, target: ServerServiceTarget, action: 'start' | 'stop' | 'restart') {
    if (target === 'remote') return this.remoteServerService[`${action}Service`](instancePath)
    try {
      const configPath = this.#serviceConfigPath(instancePath)
      if (!await pathExists(configPath)) return { ok: false, message: 'Install the Windows service first.' }
      const winSW = await this.#ensureWinSW()
      await this.#runElevated(winSW, [action, configPath])
      return { ok: true }
    } catch (error) {
      return { ok: false, message: (error as Error).message }
    }
  }

  start(instancePath: string, target: ServerServiceTarget) {
    return this.#control(instancePath, target, 'start')
  }

  stop(instancePath: string, target: ServerServiceTarget) {
    return this.#control(instancePath, target, 'stop')
  }

  restart(instancePath: string, target: ServerServiceTarget) {
    return this.#control(instancePath, target, 'restart')
  }
}