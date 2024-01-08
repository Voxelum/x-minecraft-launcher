import { InstanceFile, Platform, Resource } from '@xmcl/runtime-api'
import { AbortableTask } from '@xmcl/task'
import { Stats } from 'fs'
import { copyFile, ensureDir, stat, unlink } from 'fs-extra'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { isInSameDisk, linkWithTimeoutOrCopy } from '../util/fs'

export class LinkFilesTask extends AbortableTask<void> {
  constructor(
    readonly copyOrLinkQueue: Array<{ file: InstanceFile; destination: string; done?: boolean }>,
    readonly resourceLinkQueue: Array<{ file: InstanceFile; destination: string; resource: Resource; done?: boolean }>,
    readonly platform: Platform,
  ) {
    super()
    this._total = copyOrLinkQueue.length + resourceLinkQueue.length
    this.name = 'link'
    this.param = { count: this._total }
  }

  tryLink = async (filePath: string, destination: string, size: number, fstat?: Stats) => {
    if (fstat) {
      // existed file
      await unlink(destination)
    }
    await ensureDir(dirname(destination))
    if (isInSameDisk(filePath, destination, this.platform.os)) {
      await linkWithTimeoutOrCopy(filePath, destination)
    } else {
      await copyFile(filePath, destination)
    }
    this._progress++
    this.update(size)
  }

  handleFile = async (job: { file: InstanceFile; destination: string; done?: boolean }) => {
    if (job.done) return
    const filePath = fileURLToPath(job.file.downloads![0])
    const fstat = await stat(job.destination).catch(() => undefined)
    if (fstat && fstat.ino === (await stat(filePath)).ino) {
      // existed file, but same
      job.done = true
      return
    }
    await this.tryLink(filePath, job.destination, job.file.size, fstat)
    job.done = true
  }

  handleResource = async (job: { resource: Resource; destination: string; done?: boolean }) => {
    if (job.done) return
    const fstat = await stat(job.destination).catch(() => undefined)
    if (fstat && fstat.ino === job.resource.ino) {
      // existed file, but same
      job.done = true
      return
    }
    await this.tryLink(job.resource.path, job.destination, job.resource.size, fstat)
    job.done = true
  }

  protected async process(): Promise<void> {
    await Promise.all([
      ...this.copyOrLinkQueue.map(async (job) => this.handleFile(job)),
      ...this.resourceLinkQueue.map(async (job) => this.handleResource(job)),
    ])
  }

  protected abort(isCancelled: boolean): void {
  }

  protected isAbortedError(e: any): boolean {
    return false
  }
}
