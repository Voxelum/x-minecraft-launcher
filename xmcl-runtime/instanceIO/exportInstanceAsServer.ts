import { ExportInstanceAsServerOptions } from '@xmcl/runtime-api';
import { SSHManager } from '../ssh/SSHManager';
import { InstanceIOService } from './InstanceIOService';
import { SSHInstanceExporter } from './SSHInstanceExporter';
import { FSInstanceExporter } from './instanceExportServer';
import { BaseTask, task } from '@xmcl/task';

class UploadSSHTask extends BaseTask<void> {
  constructor(
    private exporter: SSHInstanceExporter,
    private options: ExportInstanceAsServerOptions,
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
    const options = this.options
    await this.exporter.exportInstance(options.options, options.files);
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
  if (options.output.type === 'folder') {
    await new FSInstanceExporter(this.app, this.getPath(), options.output.path).exportInstance(options.options, options.files);
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
    const exporter = new SSHInstanceExporter(this.app, this.getPath(), options.output.path, ssh, sftp)

    await this.submit(new UploadSSHTask(
      exporter,
      options,
    ))

    sftp.end();
    ssh.end();
  }
}
