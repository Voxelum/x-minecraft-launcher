import {
  ServerFSExporter,
  ServerSSHExporter,
  deriveLocalServerBundleMetadata,
  exportLocalServerBundle,
  parseInstanceFiles,
  parseLauncherData,
  preflightLocalServerBundle,
  type InstanceFile,
} from '@xmcl/instance'
import {
  InstanceIOServiceKey,
  type ExportInstanceAsServerOptions,
  type DeployInstanceToSharedHostingOptions,
  type ExportInstanceForSharedHostingOptions,
  type InstanceIOService as IInstanceIOService,
  type InstanceType,
  type SharedHostingBundleExport,
  type SharedHostingBundlePreview,
  type ThirdPartyLauncherManifest,
} from '@xmcl/runtime-api'
import { AnyError, isSystemError } from '@xmcl/utils'
import { basename, join } from 'path'
import { mkdir, unlink } from 'fs/promises'
import { randomUUID } from 'crypto'
import { Inject, LauncherAppKey, kGameDataPath, type PathResolver } from '~/app'
import { SSHManager } from '~/infra'
import { InstanceService } from '~/instance'
import { LaunchService } from '~/launch'
import { AbstractService, ExposeServiceKey } from '~/service'
import { VersionService } from '~/launch'
import { LauncherApp } from '../app/LauncherApp'
import { copyPassively, isPathDiskRootPath } from '../util/fs'
import { uploadSSH } from './utils/uploadSSH'
import { SharedHostingDeploymentService } from '~/sharedHosting/SharedHostingDeploymentService'

@ExposeServiceKey(InstanceIOServiceKey)
export class InstanceIOService extends AbstractService implements IInstanceIOService {
  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(kGameDataPath) protected getPath: PathResolver,
    @Inject(VersionService) protected versionService: VersionService,
  ) {
    super(app)
  }

  async deployInstanceToSharedHosting(
    options: DeployInstanceToSharedHostingOptions,
  ) {
    const directory = join(this.app.appDataPath, 'shared-hosting-exports')
    const outputPath = join(directory, `${randomUUID()}.xmcl-server-bundle`)
    await mkdir(directory, { recursive: true })
    try {
      const exported = await this.exportInstanceForSharedHosting({
        ...options,
        outputPath,
      })
      const sharedHosting = await this.app.registry.get(SharedHostingDeploymentService)
      return await sharedHosting.uploadLocalServerBundle({
        serviceId: options.serviceId,
        bundlePath: exported.outputPath,
        expectedSha256: exported.archiveSha256,
        expectedSizeBytes: exported.archiveSizeBytes,
        idempotencyKey: options.idempotencyKey,
      })
    } finally {
      await unlink(outputPath).catch(() => undefined)
    }
  }

  async exportInstanceAsServer(options: ExportInstanceAsServerOptions): Promise<void> {
    const launchService = await this.app.registry.get(LaunchService)
    const versionService = await this.app.registry.get(VersionService)
    const serverVersion = await versionService.resolveServerVersion(options.options.version)
    const ops = await launchService.generateServerOptions(options.options, serverVersion)
    if (options.output.type === 'folder') {
      await new ServerFSExporter(this.getPath(), options.output.path).exportInstance(
        options.options.gameDirectory,
        ops,
        options.files.map((f) => f.path),
      )
    } else if (options.output.type === 'ssh') {
      const manager = await this.app.registry.getOrCreate(SSHManager)
      const ssh = await manager.open({
        host: options.output.host,
        port: options.output.port,
        username: options.output.username,
        credentials: options.output.credentials,
      })
      const sftp = await manager.openSFTP(ssh)
      if (!sftp) {
        throw new Error('Failed to open sftp')
      }

      const exporter = new ServerSSHExporter(this.getPath(), options.output.path, ssh, sftp)

      await uploadSSH(
        exporter,
        options.options.gameDirectory,
        ops,
        options.files.map((f) => f.path),
      )

      sftp.end()
      ssh.end()
    }
  }

  async previewInstanceForSharedHosting(
    options: Omit<ExportInstanceForSharedHostingOptions, 'outputPath' | 'acknowledgeWarnings'>,
  ): Promise<SharedHostingBundlePreview> {
    const resolved = await this.versionService.resolveLocalVersion(options.options.version)
    const metadata = deriveLocalServerBundleMetadata({
      instanceName: options.instanceName,
      minecraftVersion: resolved.minecraftVersion,
      javaVersion: resolved.javaVersion,
      libraries: resolved.libraries,
      runtimeCatalog: options.runtimeCatalog,
    })
    const preflight = await preflightLocalServerBundle({
      instancePath: options.options.gameDirectory,
      metadata,
      includeServerRelevantResourcePacks: options.includeServerRelevantResourcePacks,
    })
    return { metadata, preflight }
  }

  async exportInstanceForSharedHosting(
    options: ExportInstanceForSharedHostingOptions,
  ): Promise<SharedHostingBundleExport> {
    const preview = await this.previewInstanceForSharedHosting(options)
    const exported = await exportLocalServerBundle({
      instancePath: options.options.gameDirectory,
      outputPath: options.outputPath,
      metadata: preview.metadata,
      includeServerRelevantResourcePacks: options.includeServerRelevantResourcePacks,
      acknowledgeWarnings: options.acknowledgeWarnings,
    })
    return {
      metadata: preview.metadata,
      preflight: exported.preflight,
      outputPath: exported.outputPath,
      archiveSha256: exported.archiveSha256,
      archiveSizeBytes: exported.archiveSizeBytes,
      manifest: exported.manifest,
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
    const result = await parseInstanceFiles(path, type === 'prism' ? 'mmc' : type)
    return result
  }

  async parseLauncherData(path: string, type?: InstanceType): Promise<ThirdPartyLauncherManifest> {
    // Refuse drive-root paths up front. The recursive scanners below would
    // otherwise descend into kernel-locked Windows entries (pagefile.sys,
    // System Volume Information, …) and surface noisy EBUSY exceptions
    // during the first-launch migrate wizard.
    if (isPathDiskRootPath(path)) {
      throw new AnyError('BadInstance', `Refusing to scan drive root: ${path}`, undefined, { path })
    }
    try {
      const result = await parseLauncherData(path, type === 'prism' ? 'mmc' : type)
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

    await Promise.allSettled(
      instances.map(async ({ path, options }) => {
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
      }),
    )
  }
}
