import type { ServerOptions } from '@xmcl/core';
import { ServerSSHExporter } from '@xmcl/instance';
import { BaseTask } from '@xmcl/task';

export class UploadSSHTask extends BaseTask<void> {
  constructor(
    private exporter: ServerSSHExporter,
    private serverDir: string,
    private options: ServerOptions,
    private files: string[]
  ) {
    super();
    this.name = 'server.upload';
  }

  protected async runTask(): Promise<void> {
    this.exporter.onProgress = (chunk, progress, total) => {
      this._progress = progress;
      this._total = total;
      this.update(chunk);
    };
    await this.exporter.exportInstance(this.serverDir, this.options, this.files);
  }

  protected async cancelTask(timeout?: number | undefined): Promise<void> {
    this.exporter.abort();
  }
  protected async pauseTask(): Promise<void> {
    this.exporter.abort();
  }
  protected async resumeTask(): Promise<void> {
    this.runTask();
  }
}
