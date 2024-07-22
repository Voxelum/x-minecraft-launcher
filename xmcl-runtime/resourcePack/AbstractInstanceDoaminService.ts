import { InstanceResourcePacksService as IInstanceResourcePacksService, LockKey, Resource, ResourceDomain } from '@xmcl/runtime-api'
import { existsSync } from 'fs'
import { ensureDir, mkdir, readdir, remove, rename, stat, unlink } from 'fs-extra'
import { basename, join } from 'path'
import { PathResolver } from '~/app'
import { InstanceService } from '~/instance'
import { ResourceService } from '~/resource'
import { AbstractService, Lock } from '~/service'
import { AnyError } from '~/util/error'
import { linkWithTimeoutOrCopy } from '../util/fs'
import { isLinked, tryLink } from '../util/linkResourceFolder'

export abstract class AbstractInstanceDoaminService extends AbstractService implements IInstanceResourcePacksService {
  protected abstract resourceService: ResourceService
  protected abstract getPath: PathResolver
  protected abstract instanceService: InstanceService
  abstract domain: ResourceDomain

  async unlink(instancePath: string): Promise<void> {
    const destPath = join(instancePath, this.domain)
    const srcPath = this.getPath(this.domain)

    const linkedStatus = await isLinked(srcPath, destPath)
    if (typeof linkedStatus === 'boolean') {
      await unlink(destPath)
      await mkdir(destPath)
    }
  }

  async isLinked(instancePath: string): Promise<boolean> {
    const destPath = join(instancePath, this.domain)
    const srcPath = this.getPath(this.domain)
    const v = await isLinked(srcPath, destPath)
    return !!v
  }

  async install(instancePath: string, resourcePack: string) {
    const fileName = basename(resourcePack)
    const src = this.getPath(this.domain, fileName)
    const dest = join(instancePath, this.domain, fileName)
    if (!existsSync(dest)) {
      throw Object.assign(new Error(), { name: 'FileNotFound' })
    }
    const fstat = await stat(src)
    if (fstat.isDirectory()) return
    await linkWithTimeoutOrCopy(src, dest)
  }

  async scan(instancePath: string): Promise<Resource[]> {
    const destPath = join(instancePath, this.domain)
    const files = await readdir(destPath).catch(() => [])

    this.log(`Import ${this.domain} directories while linking: ${instancePath}`)
    const resources = await this.resourceService.importResources(files.map(f => ({ path: join(destPath, f), domain: this.domain })))
    this.log(`Import ${resources.length}.`)

    return resources
  }

  async link(instancePath: string, force = false): Promise<boolean> {
    if (!instancePath) return false
    await this.resourceService.whenReady(this.domain)
    const destPath = join(instancePath, this.domain)
    const srcPath = this.getPath(this.domain)
    try {
      if (force) {
        const isLinked = await this.isLinked(instancePath)
        if (!isLinked) {
          // Backup the old folder
          const files = await readdir(destPath)
          const backupDir = join(destPath, '.backup')
          await ensureDir(backupDir)
          for (const f of files) {
            const s = await stat(join(destPath, f))
            if (s.isDirectory()) {
              // move to backup dir
              await rename(join(destPath, f), join(backupDir, f))
            }
          }
          await remove(destPath)
        }
      }
      const isLinked = await tryLink(srcPath, destPath, this, (path) => this.instanceService.isUnderManaged(path))
      return isLinked
    } catch (e) {
      this.error(new AnyError('LinkResourcePacksError', `Fail to link ${this.domain} folder under: "${instancePath}"`, { cause: e }))
      return false
    }
  }

  async showDirectory(path: string): Promise<void> {
    await this.app.shell.openDirectory(join(path, this.domain))
  }
}
