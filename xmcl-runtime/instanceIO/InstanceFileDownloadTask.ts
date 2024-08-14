import { DownloadOptions } from '@xmcl/file-transfer'
import { DownloadMultipleTask } from '@xmcl/installer'
import { InstanceFile } from '@xmcl/runtime-api'

export class InstanceFileDownloadTask extends DownloadMultipleTask {
  constructor(
    options: Array<{ options: DownloadOptions; file: InstanceFile }>,
    finished: Set<InstanceFile> = new Set(),
  ) {
    super(options.map(o => o.options))
    this.name = 'file'
    this.onFinished = (i) => {
      finished.add(options[i].file)
    }
  }
}
