import type { ServerOptions } from '@xmcl/core';
import { ServerFSExporter, ServerSSHExporter } from '@xmcl/instance';
import type { ExportInstanceAsServerOptions } from '@xmcl/runtime-api';
import { BaseTask } from '@xmcl/task';
import { LaunchService } from '~/launch';
import { VersionService } from '~/version';
import { SSHManager } from '../infra';
import { InstanceIOService } from './InstanceIOService';

class UploadSSHTask extends BaseTask<void> {
  constructor(
    private exporter: ServerSSHExporter,
    private serverDir: string,
    private options: ServerOptions,
    private files: string[]
  ) {
    super();
    this.name = 'server.upload'
  }

  protected async runTask(): Promise<void> {
    this.exporter.onProgress = (chunk, progress, total) => {
      this._progress = progress
      this._total = total
      this.update(chunk)
    }
    await this.exporter.exportInstance(this.serverDir, this.options, this.files);
  }

  protected async cancelTask(timeout?: number | undefined): Promise<void> {
    this.exporter.abort()
  }
  protected async pauseTask(): Promise<void> {
    this.exporter.abort()
  }
  protected async resumeTask(): Promise<void> {
    this.runTask()
  }
}


export async function exportInstanceAsServer(this: InstanceIOService, options: ExportInstanceAsServerOptions) {
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
