import { InstanceFile, Platform } from '@xmcl/runtime-api'
import { AbortableTask } from '@xmcl/task'
import { copyFile, ensureDir, stat, unlink } from 'fs-extra'
import { dirname } from 'path'
import { ENOENT_ERROR, isInSameDisk, linkWithTimeoutOrCopy } from '../util/fs'
import { isSystemError } from '~/util/error'

/**
 * Link existed files into temp folder.
 * 
 * All returned files are unhandled.
 */
export class InstanceFileLinkTask extends AbortableTask<void> {
  constructor(
    readonly files: Array<{ file: InstanceFile; src: string; destination: string }>,
    readonly platform: Platform,
    readonly finished: Set<string>,
    readonly unhandled: Array<InstanceFile>,
  ) {
    super()
    this._total = files.length
    this.name = 'link'
    this.param = { count: this._total }
  }

  handleLink = async (job: { file: InstanceFile; src: string; destination: string }) => {
    if (this.finished.has(job.file.path)) return
    const src = job.src
    const dest = job.destination

    const destStat = await stat(dest).catch(() => undefined)
    const srcStat = await stat(src)

    if (destStat) {
      if (destStat.ino === srcStat.ino) {
        // existed file, but same
        this.finished.add(job.file.path)
        return
      }

      // existed file, but different
      await unlink(dest)
    }

    await ensureDir(dirname(dest))

    if (isInSameDisk(src, dest, this.platform.os)) {
      await linkWithTimeoutOrCopy(src, dest)
    } else {
      await copyFile(src, dest)
    }

    this._progress++
    this.update(srcStat.size)
    this.finished.add(job.file.path)
  }

  protected async process(): Promise<void> {
    const unhandled = this.unhandled
    // second pass, link or copy all files
    const result = await Promise.allSettled(this.files.map(async (job) => this.handleLink(job).catch(e => {
      if (isSystemError(e) && e.name === ENOENT_ERROR) {
        // Only the not found error can continue
        unhandled.push(job.file)
      }
      throw e
    })))

    const errors = result.filter((r) => r.status === 'rejected').map((r) => (r as any).reason)
    if (errors.length > 0) {
      throw new AggregateError(errors.flatMap((e) => e instanceof AggregateError ? e.errors : e))
    }
  }

  protected abort(isCancelled: boolean): void {
  }

  protected isAbortedError(e: any): boolean {
    return false
  }
}
