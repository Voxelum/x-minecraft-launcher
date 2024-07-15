import { InstanceFile, Platform, Resource } from '@xmcl/runtime-api'
import { Stats } from 'fs'
import { copyFile, ensureDir, stat, unlink } from 'fs-extra'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { isInSameDisk, linkWithTimeoutOrCopy } from '../util/fs'

export function linkFiles(
  copyOrLinkQueue: Array<{ file: InstanceFile; destination: string }>,
  resourceLinkQueue: Array<{ file: InstanceFile; destination: string; resource: Resource }>,
  platform: Platform,
) {
  const tryLink = async (filePath: string, destination: string, size?: number, fstat?: Stats) => {
    if (fstat) {
      // existed file
      await unlink(destination)
    }
    await ensureDir(dirname(destination))
    if (isInSameDisk(filePath, destination, platform.os)) {
      await linkWithTimeoutOrCopy(filePath, destination)
    } else {
      await copyFile(filePath, destination)
    }
  }

  const handleFile = async (job: { file: InstanceFile; destination: string; done?: boolean }) => {
    if (job.done) return
    const filePath = fileURLToPath(job.file.downloads![0])
    const fstat = await stat(job.destination).catch(() => undefined)
    if (fstat && fstat.ino === (await stat(filePath)).ino) {
      // existed file, but same
      job.done = true
      return
    }
    await tryLink(filePath, job.destination, job.file.size, fstat)
    job.done = true
  }

  const handleResource = async (job: { resource: Resource; destination: string; done?: boolean }) => {
    if (job.done) return
    const fstat = await stat(job.destination).catch(() => undefined)
    if (fstat && fstat.ino === job.resource.ino) {
      // existed file, but same
      job.done = true
      return
    }
    await tryLink(job.resource.path, job.destination, job.resource.size, fstat)
    job.done = true
  }

  return Promise.all([
    ...copyOrLinkQueue.map(async (job) => handleFile(job)),
    ...resourceLinkQueue.map(async (job) => handleResource(job)),
  ])
}
