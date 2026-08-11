import { ServerFSExporter, type RemoteServerConnection, type ServerDeploymentPolicy } from '@xmcl/instance'
import {
  RemoteServerServiceKey,
  RemoteServerStatusState,
  RemoteServerLogState,
  getRemoteServerKey,
  getRemoteServerLogKey,
  type RemoteServerActionResult,
  type RemoteServerCredentialsInput,
  type ServerDeploymentPlan,
  type ServerDeploymentPreview,
  type RemoteServerService as IRemoteServerService,
  type RemoteServerStatus,
  type LaunchOptions,
} from '@xmcl/runtime-api'
import { AnyError } from '@xmcl/utils'
import { createHash, randomUUID } from 'crypto'
import { createReadStream, createWriteStream } from 'fs'
import { mkdir, mkdtemp, readdir, rm, stat } from 'fs/promises'
import { tmpdir } from 'os'
import { basename, join, posix, relative, resolve, sep } from 'path'
import { pipeline } from 'stream/promises'
import type { Client, SFTPWrapper } from 'ssh2'
import { pack } from 'tar-stream'
import { createGzip } from 'zlib'
import { Inject, kGameDataPath, LauncherAppKey, type LauncherApp, type PathResolver } from '~/app'
import { SSHManager } from '~/infra'
import { InstanceService } from '~/instance'
import { LaunchService, VersionService } from '~/launch'
import { AbstractService, ExposeServiceKey, ServiceStateManager } from '~/service'
import { createDeploymentFilePlan, type DeploymentManifest } from './deploymentPlan'

const SECRET_SERVICE = 'xmcl/remote-server'
const DEPLOYMENT_MANIFEST = '.xmcl-deploy-manifest.json'

/**
 * Top-level files under `remotePath` that the agent / UI may read & write
 * directly over SFTP. Mirrors `InstanceOptionsService`'s local `SERVER_FILES`
 * allowlist. Restricted so callers cannot read or overwrite arbitrary
 * remote paths.
 */
const REMOTE_SERVER_FILES = new Set([
  'server.properties',
  'eula.txt',
  'ops.json',
  'whitelist.json',
  'banned-ips.json',
  'banned-players.json',
  'usercache.json',
])

interface StoredCredentials {
  password?: string
  passphrase?: string
}

function shQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}

function isSafeDeploymentPath(path: string): boolean {
  return !!path && !path.includes('\\') && !posix.isAbsolute(path) && posix.normalize(path) === path && path !== '..' && !path.startsWith('../')
}

function buildUnitFile(profile: RemoteServerConnection, serviceName: string, startCommand: string): string {
  return [
    '[Unit]',
    `Description=XMCL managed Minecraft server (${serviceName})`,
    'After=network.target',
    '',
    '[Service]',
    'Type=simple',
    `WorkingDirectory=${profile.remotePath}`,
    `ExecStart=${startCommand}`,
    'Restart=on-failure',
    'RestartSec=5',
    '',
    '[Install]',
    'WantedBy=default.target',
    '',
  ].join('\n')
}

/**
 * Remote SSH server administration: connection test, `systemd --user`
 * lifecycle control, live status probing, and log tailing.
 *
 * Connection metadata lives on `instance.remoteServer`; target-independent
 * service desired state lives on `instance.serverConfig.service`. This service
 * owns only credentials and actions that require an SSH session.
 */
@ExposeServiceKey(RemoteServerServiceKey)
export class RemoteServerService extends AbstractService implements IRemoteServerService {
  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(kGameDataPath) private getPath: PathResolver,
  ) {
    super(app)
  }

  #getProfile(instancePath: string): RemoteServerConnection {
    const instance = this.instanceService.state.all[instancePath]
    const profile = instance?.remoteServer
    if (!profile) {
      throw new AnyError('RemoteServerError', `Remote server is not configured for ${instancePath}`)
    }
    return profile
  }

  #getServiceConfig(instancePath: string, profile = this.#getProfile(instancePath)) {
    const instance = this.instanceService.state.all[instancePath]
    const desired = instance?.serverConfig?.service
    const slug = instance?.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    return {
      name: desired?.name || profile.serviceName || `xmcl-${slug || 'server'}`,
      startCommand: desired?.startCommand || profile.startCommand || '/bin/sh server.sh',
    }
  }

  async #getCredentials(instancePath: string): Promise<StoredCredentials> {
    const raw = await this.app.secretStorage.get(SECRET_SERVICE, instancePath)
    if (!raw) return {}
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }

  async hasCredentials(instancePath: string): Promise<boolean> {
    const raw = await this.app.secretStorage.get(SECRET_SERVICE, instancePath)
    return !!raw
  }

  async setCredentials(instancePath: string, credentials: RemoteServerCredentialsInput): Promise<void> {
    await this.app.secretStorage.put(SECRET_SERVICE, instancePath, JSON.stringify(credentials))
  }

  async clearCredentials(instancePath: string): Promise<void> {
    await this.app.secretStorage.put(SECRET_SERVICE, instancePath, '')
  }

  async #connect(instancePath: string, input?: RemoteServerCredentialsInput): Promise<{ client: Client; profile: RemoteServerConnection }> {
    const profile = this.#getProfile(instancePath)
    const creds = input ?? await this.#getCredentials(instancePath)
    const credentials = profile.authMethod === 'password'
      ? { password: creds.password ?? '' }
      : { privateKey: profile.privateKeyPath ?? '', passphrase: creds.passphrase }
    const manager = await this.app.registry.getOrCreate(SSHManager)
    const client = await manager.open({
      host: profile.host,
      port: profile.port,
      username: profile.username,
      credentials,
    })
    return { client, profile }
  }

  async testConnection(instancePath: string): Promise<RemoteServerActionResult> {
    try {
      const { client } = await this.#connect(instancePath)
      const manager = await this.app.registry.getOrCreate(SSHManager)
      const result = await manager.exec(client, 'echo xmcl-ok')
      if (!result.stdout.includes('xmcl-ok')) {
        return { ok: false, message: result.stderr.trim() || 'Unexpected response from remote host.' }
      }
      return { ok: true }
    } catch (e) {
      return { ok: false, message: (e as Error).message }
    }
  }

  async uploadServer(instancePath: string, options: LaunchOptions, plan: ServerDeploymentPlan, credentials?: RemoteServerCredentialsInput): Promise<void> {
    const { client, profile } = await this.#connect(instancePath, credentials)
    const manager = await this.app.registry.getOrCreate(SSHManager)
    const sftp = await manager.openSFTP(client)
    if (!sftp) throw new Error('Failed to open SFTP')
    try {
      const launchService = await this.app.registry.get(LaunchService)
      const versionService = await this.app.registry.get(VersionService)
      const serverVersion = await versionService.resolveServerVersion(options.version)
      const runtimeDirectory = this.getPath()
      const ops = await launchService.generateServerOptions({ ...options, gameDirectory: runtimeDirectory }, serverVersion)
      await this.#uploadRuntimeArchive(client, profile, sftp, runtimeDirectory, ops)
      await this.#uploadSelectedServerFiles(client, profile, sftp, resolve(options.gameDirectory, 'server'), plan)
    } finally {
      sftp.end()
      await manager.close(profile)
    }
  }

  async #resolveSelectedServerFiles(localRoot: string, plan: ServerDeploymentPlan) {
    const files = plan.files
    return await Promise.all(files.map(async (file) => {
      const source = resolve(localRoot, file.path)
      const fromRoot = relative(localRoot, source)
      if (!fromRoot || fromRoot === '..' || fromRoot.startsWith(`..${sep}`)) {
        throw new AnyError('RemoteServerError', `Invalid server file path: ${file.path}`)
      }
      const target = fromRoot.replaceAll('\\', '/')
      let hash = file.hashes?.sha1
      if (!hash) {
        const digest = createHash('sha1')
        for await (const chunk of createReadStream(source)) digest.update(chunk)
        hash = digest.digest('hex')
      }
      return {
        source,
        target,
        category: file.category,
        policy: plan.policies[file.category],
        fingerprint: `sha1:${hash}`,
        size: file.size ?? 0,
      }
    }))
  }

  async #createServerArchive(files: Array<{ source: string; target: string }>) {
    const directory = await mkdtemp(join(tmpdir(), 'xmcl-server-deploy-'))
    const path = join(directory, 'server.tar.gz')
    const archive = pack()
    const output = pipeline(archive, createGzip({ level: 1 }), createWriteStream(path))
    output.catch(() => undefined)
    try {
      for (const file of files) {
        const fileStat = await stat(file.source)
        const entry = archive.entry({
          name: file.target,
          size: fileStat.size,
          mode: fileStat.mode & 0o777,
          mtime: fileStat.mtime,
        })
        await pipeline(createReadStream(file.source), entry)
      }
      archive.finalize()
      await output
      return { directory, path }
    } catch (error) {
      archive.destroy(error as Error)
      await output.catch(() => undefined)
      await rm(directory, { recursive: true, force: true })
      throw error
    }
  }

  async #collectArchiveFiles(root: string, directory = root): Promise<Array<{ source: string; target: string }>> {
    const files: Array<{ source: string; target: string }> = []
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const source = join(directory, entry.name)
      if (entry.isDirectory()) {
        files.push(...await this.#collectArchiveFiles(root, source))
      } else {
        files.push({ source, target: relative(root, source).replaceAll('\\', '/') })
      }
    }
    return files
  }

  async #uploadRuntimeArchive(client: Client, profile: RemoteServerConnection, sftp: SFTPWrapper, runtimeDirectory: string, options: Parameters<ServerFSExporter['exportInstance']>[1]) {
    const manager = await this.app.registry.getOrCreate(SSHManager)
    const remoteRoot = profile.remotePath.replace(/\/+$/, '')
    const prepare = await manager.exec(client, `command -v tar >/dev/null 2>&1 && mkdir -p ${shQuote(remoteRoot)}`)
    if (prepare.code !== 0) throw new Error(prepare.stderr.trim() || 'tar is required to deploy the remote server.')
    const exportDirectory = await mkdtemp(join(tmpdir(), 'xmcl-server-runtime-'))
    const exportRoot = join(exportDirectory, 'runtime')
    let archive: { directory: string; path: string } | undefined
    const deploymentId = randomUUID()
    const remoteArchive = `${remoteRoot}/.xmcl-runtime-${deploymentId}.tar.gz`
    try {
      await mkdir(exportRoot)
      const exporter = new ServerFSExporter(runtimeDirectory, exportRoot)
      await exporter.exportInstance(runtimeDirectory, options, [])
      const runtimeArchive = await this.#createServerArchive(await this.#collectArchiveFiles(exportRoot))
      archive = runtimeArchive
      await new Promise<void>((resolveUpload, rejectUpload) => {
        sftp.fastPut(runtimeArchive.path, remoteArchive, error => error ? rejectUpload(error) : resolveUpload())
      })
      const extract = await manager.exec(client, `tar -xzf ${shQuote(remoteArchive)} -C ${shQuote(remoteRoot)}`)
      if (extract.code !== 0) throw new Error(extract.stderr.trim() || 'Failed to extract remote server runtime.')
    } finally {
      await manager.exec(client, `rm -f ${shQuote(remoteArchive)}`).catch(() => undefined)
      if (archive) await rm(archive.directory, { recursive: true, force: true })
      await rm(exportDirectory, { recursive: true, force: true })
    }
  }

  async #readDeploymentManifest(sftp: SFTPWrapper, remoteRoot: string): Promise<DeploymentManifest> {
    const content = await new Promise<Buffer | undefined>((resolveRead, rejectRead) => {
      sftp.readFile(`${remoteRoot}/${DEPLOYMENT_MANIFEST}`, (error, data) => {
        if ((error as Error & { code?: number } | undefined)?.code === 2) resolveRead(undefined)
        else if (error) rejectRead(error)
        else resolveRead(data)
      })
    })
    if (!content) return { version: 2, files: {} }
    try {
      const parsed = JSON.parse(content.toString()) as DeploymentManifest
      if (parsed.version === 2 && parsed.files && typeof parsed.files === 'object') {
        const files: DeploymentManifest['files'] = {}
        for (const [path, record] of Object.entries(parsed.files)) {
          if (isSafeDeploymentPath(path) && typeof record?.fingerprint === 'string' && ['config', 'mods', 'world', 'extra'].includes(record.category) && ['mirror', 'overlay', 'initialize'].includes(record.policy)) {
            files[path] = record
          }
        }
        return { version: 2, files }
      }
    } catch { }
    return { version: 2, files: {} }
  }

  async #writeDeploymentManifest(client: Client, sftp: SFTPWrapper, remoteRoot: string, manifest: DeploymentManifest) {
    const manager = await this.app.registry.getOrCreate(SSHManager)
    const target = `${remoteRoot}/${DEPLOYMENT_MANIFEST}`
    const temporary = `${target}.tmp-${randomUUID()}`
    try {
      await new Promise<void>((resolveWrite, rejectWrite) => {
        sftp.writeFile(temporary, JSON.stringify(manifest), (error) => error ? rejectWrite(error) : resolveWrite())
      })
      const move = await manager.exec(client, `mv -f ${shQuote(temporary)} ${shQuote(target)}`)
      if (move.code !== 0) throw new Error(move.stderr.trim() || 'Failed to update remote deployment manifest.')
    } finally {
      await manager.exec(client, `rm -f ${shQuote(temporary)}`).catch(() => undefined)
    }
  }

  async #planSelectedServerFiles(client: Client, profile: RemoteServerConnection, sftp: SFTPWrapper, localRoot: string, plan: ServerDeploymentPlan) {
    const manager = await this.app.registry.getOrCreate(SSHManager)
    const selectedFiles = await this.#resolveSelectedServerFiles(localRoot, plan)
    const remoteRoot = profile.remotePath.replace(/\/+$/, '')
    const previousManifest = await this.#readDeploymentManifest(sftp, remoteRoot)
    const initializeRoots = [...new Set(selectedFiles
      .filter(file => file.policy === 'initialize' && !previousManifest.files[file.target])
      .map(file => file.target.includes('/') ? file.target.slice(0, file.target.indexOf('/')) : file.target))]
    const existingInitializeRoots = new Set<string>()
    if (initializeRoots.length > 0) {
      const checks = initializeRoots.map((root, index) => `if [ -e ${shQuote(`${remoteRoot}/${root}`)} ]; then printf '${index}\\n'; fi`).join('; ')
      const existing = await manager.exec(client, checks)
      if (existing.code !== 0) throw new Error(existing.stderr.trim() || 'Failed to inspect initialized remote data.')
      for (const value of existing.stdout.trim().split(/\s+/)) {
        const index = Number(value)
        if (Number.isInteger(index) && initializeRoots[index]) existingInitializeRoots.add(initializeRoots[index])
      }
    }

    const filePlan = createDeploymentFilePlan(selectedFiles, previousManifest, plan.policies, existingInitializeRoots)
    return { selectedFiles, previousManifest, ...filePlan, remoteRoot }
  }

  async #uploadSelectedServerFiles(client: Client, profile: RemoteServerConnection, sftp: SFTPWrapper, localRoot: string, planInput: ServerDeploymentPlan) {
    const manager = await this.app.registry.getOrCreate(SSHManager)
    const prepare = await manager.exec(client, `mkdir -p ${shQuote(profile.remotePath)}`)
    if (prepare.code !== 0) throw new Error(prepare.stderr.trim() || 'Failed to prepare remote server directory.')
    const plan = await this.#planSelectedServerFiles(client, profile, sftp, localRoot, planInput)
    const tar = await manager.exec(client, 'command -v tar >/dev/null 2>&1')
    if (tar.code !== 0) throw new Error('tar is required to deploy the remote server.')

    if (plan.changedFiles.length > 0) {
      const archive = await this.#createServerArchive(plan.changedFiles)
      const deploymentId = randomUUID()
      const remoteArchive = `${plan.remoteRoot}/.xmcl-deploy-${deploymentId}.tar.gz`
      const remoteStage = `${plan.remoteRoot}/.xmcl-deploy-${deploymentId}`
      try {
        await new Promise<void>((resolveUpload, rejectUpload) => {
          sftp.fastPut(archive.path, remoteArchive, (error) => error ? rejectUpload(error) : resolveUpload())
        })
        const extract = await manager.exec(client, [
          `rm -rf ${shQuote(remoteStage)}`,
          `mkdir -p ${shQuote(remoteStage)}`,
          `tar -xzf ${shQuote(remoteArchive)} -C ${shQuote(remoteStage)}`,
          `cp -a ${shQuote(`${remoteStage}/.`)} ${shQuote(`${plan.remoteRoot}/`)}`,
        ].join(' && '))
        if (extract.code !== 0) throw new Error(extract.stderr.trim() || 'Failed to extract remote server archive.')
      } finally {
        await manager.exec(client, `rm -rf ${shQuote(remoteArchive)} ${shQuote(remoteStage)}`).catch(() => undefined)
        await rm(archive.directory, { recursive: true, force: true })
      }
    }

    if (plan.removedFiles.length > 0) {
      const remove = await manager.exec(client, `rm -f -- ${plan.removedFiles.map(path => shQuote(`${plan.remoteRoot}/${path}`)).join(' ')}`)
      if (remove.code !== 0) throw new Error(remove.stderr.trim() || 'Failed to remove stale remote server files.')
    }

    const nextManifest: DeploymentManifest = { version: 2, files: { ...plan.previousManifest.files } }
    for (const path of plan.removedFiles) delete nextManifest.files[path]
    for (const action of plan.actions) {
      if (action.file.policy === 'preserve') continue
      if (!action.managed) {
        delete nextManifest.files[action.file.target]
      } else if (action.kind !== 'skip' || action.file.policy !== 'initialize') {
        nextManifest.files[action.file.target] = {
          fingerprint: action.file.fingerprint,
          category: action.file.category,
          policy: action.file.policy as Exclude<ServerDeploymentPolicy, 'preserve'>,
        }
      }
    }
    await this.#writeDeploymentManifest(client, sftp, plan.remoteRoot, nextManifest)
  }

  async previewServerDeployment(instancePath: string, planInput: ServerDeploymentPlan): Promise<ServerDeploymentPreview> {
    const { client, profile } = await this.#connect(instancePath)
    const manager = await this.app.registry.getOrCreate(SSHManager)
    const sftp = await manager.openSFTP(client)
    if (!sftp) throw new Error('Failed to open SFTP')
    try {
      const plan = await this.#planSelectedServerFiles(client, profile, sftp, resolve(instancePath, 'server'), planInput)
      return plan.preview
    } finally {
      sftp.end()
      await manager.close(profile)
    }
  }

  async setDeploymentRevision(instancePath: string, revision: string): Promise<void> {
    const { client, profile } = await this.#connect(instancePath)
    const manager = await this.app.registry.getOrCreate(SSHManager)
    try {
      const result = await manager.exec(client, [
        `mkdir -p ${shQuote(profile.remotePath)}`,
        `printf '%s' ${shQuote(revision)} > ${shQuote(`${profile.remotePath}/.xmcl-revision`)}`,
      ].join(' && '))
      if (result.code !== 0) throw new Error(result.stderr.trim() || 'Failed to record deployment revision.')
    } finally {
      await manager.close(profile)
    }
  }

  async #probe(client: Client, profile: RemoteServerConnection, instancePath: string): Promise<RemoteServerStatus> {
    const manager = await this.app.registry.getOrCreate(SSHManager)
    const SEP = '__XMCL_SEP__'
    const service = this.#getServiceConfig(instancePath, profile)
    const unit = service.name ? shQuote(`${service.name}.service`) : undefined
    const script = [
      unit ? `systemctl --user is-active ${unit} 2>/dev/null` : 'echo unknown',
      `echo ${SEP}`,
      unit ? `systemctl --user show ${unit} --property=MainPID --value 2>/dev/null` : 'echo 0',
      `echo ${SEP}`,
      unit ? `(systemctl --user cat ${unit} >/dev/null 2>&1 && echo yes || echo no)` : 'echo no',
      `echo ${SEP}`,
      `(test -d ${shQuote(profile.remotePath)} && find ${shQuote(profile.remotePath)} -mindepth 1 -maxdepth 1 -type f \\( -name '*.jar' -o -name 'server.sh' -o -name 'server.bat' -o -name 'run.sh' \\) -print -quit | grep -q . && echo yes || echo no)`,
      `echo ${SEP}`,
      'uname -s 2>/dev/null || echo unknown',
      `echo ${SEP}`,
      '(command -v java >/dev/null 2>&1 && echo yes || echo no)',
      `echo ${SEP}`,
      '(command -v systemctl >/dev/null 2>&1 && echo yes || echo no)',
      `echo ${SEP}`,
      `(mkdir -p ${shQuote(profile.remotePath)} 2>/dev/null && test -w ${shQuote(profile.remotePath)} && echo yes || echo no)`,
      `echo ${SEP}`,
      `(test -f ${shQuote(`${profile.remotePath}/world/level.dat`)} && echo yes || echo no)`,
      `echo ${SEP}`,
      `cat ${shQuote(`${profile.remotePath}/.xmcl-revision`)} 2>/dev/null || true`,
      `echo ${SEP}`,
      "cat /proc/loadavg 2>/dev/null || echo '0 0 0'",
      `echo ${SEP}`,
      "free -m 2>/dev/null | awk '/^Mem:/ {print $2, $3}'",
      `echo ${SEP}`,
      `df -m ${shQuote(profile.remotePath)} 2>/dev/null | awk 'NR==2 {print $2, $3}'`,
    ].join('\n')

    const result = await manager.exec(client, script)
    if (result.code !== 0) throw new Error(result.stderr.trim() || `Remote status probe failed with exit code ${result.code}.`)
    const [activeRaw, pidRaw, installedRaw, serverInstalledRaw, platformRaw, javaRaw, systemdRaw, writableRaw, worldRaw, revisionRaw, loadRaw, memRaw, diskRaw] = result.stdout
      .split(SEP)
      .map((s) => s.trim())

    const load = (loadRaw ?? '').split(/\s+/).slice(0, 3).map(Number)
    const mem = (memRaw ?? '').split(/\s+/).map(Number)
    const disk = (diskRaw ?? '').split(/\s+/).map(Number)
    const pid = Number(pidRaw)

    return {
      connected: true,
      checkedAt: Date.now(),
      serviceInstalled: installedRaw === 'yes',
      serverInstalled: serverInstalledRaw === 'yes',
      platform: platformRaw || undefined,
      javaAvailable: javaRaw === 'yes',
      systemdAvailable: systemdRaw === 'yes',
      remotePathWritable: writableRaw === 'yes',
      worldPresent: worldRaw === 'yes',
      appliedRevision: revisionRaw || undefined,
      serviceActive: activeRaw === 'active',
      pid: Number.isFinite(pid) && pid > 0 ? pid : undefined,
      loadAverage: load.length >= 3 && load.every(Number.isFinite) ? [load[0], load[1], load[2]] : undefined,
      memoryTotalMB: Number.isFinite(mem[0]) ? mem[0] : undefined,
      memoryUsedMB: Number.isFinite(mem[1]) ? mem[1] : undefined,
      diskTotalMB: Number.isFinite(disk[0]) ? disk[0] : undefined,
      diskUsedMB: Number.isFinite(disk[1]) ? disk[1] : undefined,
    }
  }

  async #queryStatus(instancePath: string): Promise<RemoteServerStatus> {
    const { client, profile } = await this.#connect(instancePath)
    return this.#probe(client, profile, instancePath)
  }

  async getStatus(instancePath: string): Promise<RemoteServerStatus> {
    try {
      return await this.#queryStatus(instancePath)
    } catch (e) {
      return { connected: false, checkedAt: Date.now(), error: (e as Error).message }
    }
  }

  async watchStatus(instancePath: string) {
    const stateManager = await this.app.registry.get(ServiceStateManager)
    return stateManager.registerOrGet(getRemoteServerKey(instancePath), async () => {
      const state = new RemoteServerStatusState()

      const refresh = async () => {
        try {
          const status = await this.#queryStatus(instancePath)
          state.remoteServerStatus(status)
        } catch (e) {
          state.remoteServerStatus({ connected: false, checkedAt: Date.now(), error: (e as Error).message })
        }
      }

      await refresh()

      return [state, () => { }, refresh]
    })
  }

  async refreshStatus(instancePath: string): Promise<void> {
    const stateManager = await this.app.registry.get(ServiceStateManager)
    await stateManager.revalidate(getRemoteServerKey(instancePath))
  }

  async installService(instancePath: string): Promise<RemoteServerActionResult> {
    const { client, profile } = await this.#connect(instancePath)
    const service = this.#getServiceConfig(instancePath, profile)
    if (!service.name || !service.startCommand) {
      return { ok: false, message: 'Set a service name and start command before installing the service.' }
    }
    const manager = await this.app.registry.getOrCreate(SSHManager)

    const home = (await manager.exec(client, 'echo $HOME')).stdout.trim()
    if (!home) return { ok: false, message: 'Failed to resolve remote $HOME.' }

    const unitDir = `${home}/.config/systemd/user`
    const unitPath = `${unitDir}/${service.name}.service`
    const unitContent = buildUnitFile(profile, service.name, service.startCommand)

    const mkdir = await manager.exec(client, `mkdir -p ${shQuote(unitDir)}`)
    if (mkdir.code !== 0) return { ok: false, message: mkdir.stderr.trim() || 'Failed to create systemd user directory.' }

    const write = await manager.exec(client, `cat > ${shQuote(unitPath)} <<'XMCL_UNIT_EOF'\n${unitContent}XMCL_UNIT_EOF`)
    if (write.code !== 0) return { ok: false, message: write.stderr.trim() || 'Failed to write unit file.' }

    // Best-effort: lets the unit keep running after the SSH session/login
    // ends. Some hosts restrict this to an admin; ignore failures.
    await manager.exec(client, `loginctl enable-linger ${shQuote(profile.username)}`).catch(() => undefined)

    const reload = await manager.exec(client, 'systemctl --user daemon-reload')
    if (reload.code !== 0) return { ok: false, message: reload.stderr.trim() || 'daemon-reload failed.' }

    const enable = await manager.exec(client, `systemctl --user enable ${shQuote(service.name + '.service')}`)
    if (enable.code !== 0) return { ok: false, message: enable.stderr.trim() || 'Failed to enable service.' }

    return { ok: true }
  }

  async uninstallService(instancePath: string): Promise<RemoteServerActionResult> {
    const { client, profile } = await this.#connect(instancePath)
    const service = this.#getServiceConfig(instancePath, profile)
    if (!service.name) return { ok: false, message: 'No service configured.' }
    const manager = await this.app.registry.getOrCreate(SSHManager)
    const unit = `${service.name}.service`

    await manager.exec(client, `systemctl --user disable --now ${shQuote(unit)}`).catch(() => undefined)

    const home = (await manager.exec(client, 'echo $HOME')).stdout.trim()
    const unitPath = `${home}/.config/systemd/user/${unit}`
    const rm = await manager.exec(client, `rm -f ${shQuote(unitPath)}`)
    await manager.exec(client, 'systemctl --user daemon-reload').catch(() => undefined)

    if (rm.code !== 0) return { ok: false, message: rm.stderr.trim() || 'Failed to remove unit file.' }
    return { ok: true }
  }

  async #systemctl(instancePath: string, action: 'start' | 'stop' | 'restart'): Promise<RemoteServerActionResult> {
    const { client, profile } = await this.#connect(instancePath)
    const service = this.#getServiceConfig(instancePath, profile)
    if (!service.name) return { ok: false, message: 'No service configured. Install the service first.' }
    const manager = await this.app.registry.getOrCreate(SSHManager)
    const result = await manager.exec(client, `systemctl --user ${action} ${shQuote(service.name + '.service')}`)
    if (result.code !== 0) return { ok: false, message: result.stderr.trim() || `Failed to ${action} service.` }
    return { ok: true }
  }

  startService(instancePath: string): Promise<RemoteServerActionResult> {
    return this.#systemctl(instancePath, 'start')
  }

  stopService(instancePath: string): Promise<RemoteServerActionResult> {
    return this.#systemctl(instancePath, 'stop')
  }

  restartService(instancePath: string): Promise<RemoteServerActionResult> {
    return this.#systemctl(instancePath, 'restart')
  }

  #resolveRemoteFile(profile: RemoteServerConnection, file: string) {
    if (basename(file) !== file || !REMOTE_SERVER_FILES.has(file)) {
      throw new AnyError('RemoteServerError', `Invalid or unsupported remote server file: ${file}`)
    }
    return `${profile.remotePath}/${file}`
  }

  async readRemoteFile(instancePath: string, file: string): Promise<string> {
    const { client, profile } = await this.#connect(instancePath)
    const target = this.#resolveRemoteFile(profile, file)
    const manager = await this.app.registry.getOrCreate(SSHManager)
    const sftp = await manager.openSFTP(client)
    if (!sftp) throw new AnyError('RemoteServerError', 'Failed to open SFTP session.')
    return new Promise<string>((resolve, reject) => {
      sftp.readFile(target, 'utf-8' as any, (err, data) => {
        if (err) {
          // ssh2 surfaces a missing remote file as a generic SFTP status error;
          // treat it as "no content yet" like the local getServerFile does.
          if ((err as any).code === 2) resolve('')
          else reject(err)
        } else {
          resolve(data.toString())
        }
      })
    })
  }

  async writeRemoteFile(instancePath: string, file: string, content: string): Promise<void> {
    const { client, profile } = await this.#connect(instancePath)
    const target = this.#resolveRemoteFile(profile, file)
    const manager = await this.app.registry.getOrCreate(SSHManager)
    const sftp = await manager.openSFTP(client)
    if (!sftp) throw new AnyError('RemoteServerError', 'Failed to open SFTP session.')
    await new Promise<void>((resolve, reject) => {
      sftp.writeFile(target, content, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  async tailLog(instancePath: string, lines = 200): Promise<string> {
    const { client, profile } = await this.#connect(instancePath)
    const manager = await this.app.registry.getOrCreate(SSHManager)
    const logPath = `${profile.remotePath}/logs/latest.log`
    const result = await manager.exec(client, `tail -n ${Math.max(1, Math.min(2000, Math.floor(lines)))} ${shQuote(logPath)}`)
    return result.stdout
  }

  async watchLog(instancePath: string) {
    const stateManager = await this.app.registry.get(ServiceStateManager)
    return stateManager.registerOrGet(getRemoteServerLogKey(instancePath), async () => {
      const state = new RemoteServerLogState()
      const { client, profile } = await this.#connect(instancePath)
      const manager = await this.app.registry.getOrCreate(SSHManager)
      const logPath = `${profile.remotePath}/logs/latest.log`

      let buffer = ''
      const handle = await manager.execStream(
        client,
        `tail -n 200 -f ${shQuote(logPath)}`,
        (chunk) => {
          buffer += chunk
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          if (lines.length > 0) state.remoteServerLogAppend(lines)
        },
      )

      return [state, () => {
        handle.close()
      }]
    })
  }
}
