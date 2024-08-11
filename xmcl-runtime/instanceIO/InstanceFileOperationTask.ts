import { InstanceFile, InstanceFileWithOperation, Platform, Resource } from '@xmcl/runtime-api'
import { AbortableTask } from '@xmcl/task'
import { Stats } from 'fs'
import { copyFile, ensureDir, rename, stat, unlink } from 'fs-extra'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { isInSameDisk, linkWithTimeoutOrCopy } from '../util/fs'

export class InstanceFileOperationTask extends AbortableTask<void> {
  constructor(
    readonly copyOrLinkQueue: Array<{ file: InstanceFile; destination: string }>,
    readonly resourceLinkQueue: Array<{ file: InstanceFile; destination: string; resource: Resource }>,
    readonly filesQueue: Array<{ file: InstanceFileWithOperation; destination: string }>,
    readonly platform: Platform,
    readonly finished: Set<InstanceFile>,
  ) {
    super()
    this._total = copyOrLinkQueue.length + resourceLinkQueue.length
    this.name = 'link'
    this.param = { count: this._total }
  }

  tryLink = async (filePath: string, destination: string, size?: number, fstat?: Stats) => {
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
    this.update(size ?? 0)
  }

  handleFile = async (job: { file: InstanceFile; destination: string }) => {
    if (this.finished.has(job.file)) return
    const filePath = fileURLToPath(job.file.downloads![0])
    const fstat = await stat(job.destination).catch(() => undefined)
    if (fstat && fstat.ino === (await stat(filePath)).ino) {
      // existed file, but same
      this.finished.add(job.file)
      return
    }
    await this.tryLink(filePath, job.destination, job.file.size, fstat)
    this.finished.add(job.file)
  }

  handleResource = async (job: { file: InstanceFile; resource: Resource; destination: string }) => {
    if (this.finished.has(job.file)) return
    const fstat = await stat(job.destination).catch(() => undefined)
    if (fstat && fstat.ino === job.resource.ino) {
      // existed file, but same
      this.finished.add(job.file)
      return
    }
    await this.tryLink(job.resource.path, job.destination, job.resource.size, fstat)
    this.finished.add(job.file)
  }

  handleCommon = async ({ destination, file }: { file: InstanceFileWithOperation; destination: string }) => {
    if (this.finished.has(file)) return
    if (file.operation === 'remove') {
      await unlink(destination)
      this.finished.add(file)
    } else if (file.operation === 'backup-remove') {
      await rename(destination, destination + '.backup').catch(() => {})
      this.finished.add(file)
    } else if (file.operation === 'backup-add') {
      await rename(destination, destination + '.backup').catch(() => undefined)
      this.finished.add(file)
    }
  }

  protected async process(): Promise<void> {
    const result = await Promise.allSettled([
      ...this.copyOrLinkQueue.map(async (job) => this.handleFile(job)),
      ...this.resourceLinkQueue.map(async (job) => this.handleResource(job)),
      ...this.filesQueue.map(async (job) => this.handleCommon(job)),
    ])
    const errors = result.filter((r) => r.status === 'rejected').map((r) => (r as any).reason)
    if (errors.length > 0) {
      throw new AggregateError(errors)
    }
  }

  protected abort(isCancelled: boolean): void {
  }

  protected isAbortedError(e: any): boolean {
    return false
  }
}
