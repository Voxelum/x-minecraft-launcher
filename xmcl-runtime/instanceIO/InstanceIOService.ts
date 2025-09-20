import { ServerFSExporter, ServerSSHExporter, parseInstanceFiles, parseLauncherData, type InstanceFile } from '@xmcl/instance'
import { InstanceIOServiceKey, LockKey, type ExportInstanceAsServerOptions, type ExportInstanceOptions, type InstanceIOService as IInstanceIOService, type InstanceType, type ThirdPartyLauncherManifest } from '@xmcl/runtime-api'
import { readFile } from 'fs-extra'
import { basename, join, resolve } from 'path'
import { Inject, LauncherAppKey, kGameDataPath, type PathResolver } from '~/app'
import { SSHManager, kTaskExecutor, type TaskFn } from '~/infra'
import { InstanceService } from '~/instance'
import { AbstractService, ExposeServiceKey } from '~/service'
import { AnyError, isSystemError } from '@xmcl/utils'
import { VersionService } from '~/version'
import { LauncherApp } from '../app/LauncherApp'
import { copyPassively, exists } from '../util/fs'
import { requireObject } from '../util/object'
import { ZipTask } from '../util/zip'
import { LaunchService } from '~/launch'
import { UploadSSHTask } from './utils/UploadSSHTask'

@ExposeServiceKey(InstanceIOServiceKey)
export class InstanceIOService extends AbstractService implements IInstanceIOService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(kTaskExecutor) protected submit: TaskFn,
    @Inject(kGameDataPath) protected getPath: PathResolver,
    @Inject(VersionService) protected versionService: VersionService,
  ) {
    super(app)
  }

  async exportInstanceAsServer(options: ExportInstanceAsServerOptions): Promise<void> {
    const launchService = await this.app.registry.get(LaunchService)
    const versionService = await this.app.registry.get(VersionService)
    const serverVersion = await versionService.resolveServerVersion(options.options.version)
    const ops = await launchService.generateServerOptions(options.options, serverVersion)
    if (options.output.type === 'folder') {
      await new ServerFSExporter(this.getPath(), options.output.path).exportInstance(options.options.gameDirectory, ops, options.files.map(f => f.path));
    } else if (options.output.type === 'ssh') {
      const manager = await this.app.registry.getOrCreate(SSHManager);
      const ssh = await manager.open({
        host: options.output.host,
        port: options.output.port,
        username: options.output.username,
        credentials: options.output.credentials,
      });
      const sftp = await manager.openSFTP(ssh);
      if (!sftp) {
        throw new Error('Failed to open sftp');
      }
      const exporter = new ServerSSHExporter(this.getPath(), options.output.path, ssh, sftp)

      await this.submit(new UploadSSHTask(
        exporter,
        options.options.gameDirectory,
        ops,
        options.files.map(f => f.path)
      ))

      sftp.end();
      ssh.end();
    }
  }

  async getGameDefaultPath(type?: 'modrinth' | 'modrinth-instances' | 'vanilla' | 'curseforge') {
    if (type === 'modrinth' || type === 'modrinth-instances') {
      const dir = join(this.app.host.getPath('appData'), 'com.modrinth.theseus')
      if (type === 'modrinth-instances') {
        return join(dir, 'profiles')
      }
      return dir
    }
    if (type === 'curseforge') {
      return join(this.app.host.getPath('home'), 'curseforge', 'minecraft')
    }
    return join(this.app.host.getPath('appData'), '.minecraft')
  }

  async parseInstanceFiles(path: string, type?: InstanceType): Promise<InstanceFile[]> {
    const result = await parseInstanceFiles(path, type)
    return result
  }

  async parseLauncherData(path: string, type?: InstanceType): Promise<ThirdPartyLauncherManifest> {
    try {
      const result = await parseLauncherData(path, type)
      return result
    } catch (e) {
      if (isSystemError(e)) {
        if (e.code === 'ENOENT') {
          throw new AnyError('BadInstance', undefined, { cause: e }, { path })
        }
      }
      throw e
    }
  }

  async importLauncherData(data: ThirdPartyLauncherManifest): Promise<void> {
    const { instances, folder } = data

    if (folder.assets) {
      await copyPassively(folder.assets, this.getPath('assets'))
    }
    if (folder.libraries) {
      await copyPassively(folder.libraries, this.getPath('libraries'))
    }
    if (folder.versions) {
      await copyPassively(folder.versions, this.getPath('versions'))
    }
    if (folder.jre) {
      await copyPassively(folder.jre, this.getPath('jre'))
    }

    await Promise.allSettled(instances.map(async ({ path, options }) => {
      options.name = options.name || basename(path)
      const instPath = await this.instanceService.createInstance(options)
      await copyPassively(path, instPath, (name) => {
        if (name === 'libraries') {
          return false
        }
        if (name === 'assets') {
          return false
        }
        if (name === 'versions') {
          return false
        }
        if (name === 'java_versions') {
          return false
        }
        if (name === 'jre') {
          return false
        }
        return true
      })
    }))
  }
}
