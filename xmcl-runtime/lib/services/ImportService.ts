import { DownloadTask } from '@xmcl/installer'
import { ImportFileOptions, ImportService as IImportService, ImportServiceKey, ImportUrlOptions, Resource, ResourceDomain } from '@xmcl/runtime-api'
import { createHash } from 'crypto'
import { ensureFile } from 'fs-extra/esm'
import { unlink } from 'fs/promises'
import { basename } from 'path'
import { request } from 'undici'
import { URL } from 'url'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { parseSourceControlUrl } from '../sourceControlUrlParser'
import { Inject } from '../util/objectRegistry'
import { ZipTask } from '../util/zip'
import { InstanceService } from './InstanceService'
import { ResourceService } from './ResourceService'
import { AbstractService, ExposeServiceKey } from './Service'

@ExposeServiceKey(ImportServiceKey)
export class ImportService extends AbstractService implements IImportService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(InstanceService) private instanceService: InstanceService,
  ) {
    super(app)
  }

  async importFile(options: ImportFileOptions): Promise<void> {
    const [parsed] = await this.resourceService.importResources([options.resource])
    const getInstancePath = (inst: string | boolean) => typeof inst === 'boolean' ? this.instanceService.state.path : inst
    const resolveOptions = () => {
      if (parsed.domain === ResourceDomain.Saves) {
        return {
          shouldImport: options.savePolicy?.import ?? false,
          installToInstance: options.savePolicy?.installToInstance ?? options.installToInstance ?? true,
        }
      }
      if (parsed.domain === ResourceDomain.Modpacks) {
        return {
          shouldImport: options.modpackPolicy?.import ?? false,
          installToInstance: options.modpackPolicy?.installToInstance ?? options.installToInstance ?? true,
        }
      }
      return {
        shouldImport: true,
        installToInstance: options.installToInstance ?? true,
      }
    }
    const { shouldImport, installToInstance } = resolveOptions()
    const instancePath = getInstancePath(installToInstance)
    const packAndImport = async () => {
      // zip and import
      const tempZipPath = `${this.getTempPath(parsed.name)}.zip`
      const zipTask = new ZipTask(tempZipPath)
      await zipTask.includeAs(parsed.path, '')
      await zipTask.startAndWait()
      await this.resourceService.importResources([{ path: tempZipPath }])
      await unlink(tempZipPath)
    }
    if (parsed.fileType === 'directory') {
      // the importing object is a folder
      if (shouldImport) {
        if (parsed.domain === ResourceDomain.ResourcePacks ||
          parsed.domain === ResourceDomain.Saves ||
          parsed.domain === ResourceDomain.Modpacks) {
          await packAndImport()
        }
      }
    } else {
      // the import object is a file
      if (shouldImport) {
        await this.resourceService.importResources([{ path: parsed.path, domain: parsed.domain }])
      }
    }

    if (installToInstance) {
      await this.resourceService.install({ resource: parsed, instancePath })
    }
  }

  async previewUrl(options: ImportUrlOptions): Promise<Resource | undefined> {
    const result = await this.processUrl(options.url)

    if (result) {
      const resources = await this.resourceService.getResourcesByUris([result.url, options.url])
      let resource = resources[0] || resources[1]
      if (!resource) {
        const resolved = await this.resourceService.resolveResources([{
          path: result.destination,
        }])
        resource = resolved[0]
      }
      return resource
    }

    return undefined
  }

  private async processUrl(url: string) {
    if (url.startsWith('https://github.com') || url.startsWith('https://gitlab.com')) {
      const resolved = new URL(url)
      if (resolved.pathname.endsWith('.jar') || resolved.pathname.endsWith('.mrpack') || resolved.pathname.endsWith('.zip')) {
        url = parseSourceControlUrl(url)
        const response = await request(url, { method: 'HEAD' })
        if (response.headers['content-type'] === 'application/octet-stream') {
          const md5 = response.headers['content-md5']
          let fileName = basename(url)
          if (response.headers['content-disposition'] && typeof response.headers['content-disposition'] === 'string' && response.headers['content-disposition'].startsWith('attachment;')) {
            let disposition = response.headers['content-disposition']
            const start = disposition.indexOf('filename=')
            disposition = disposition.substring(start)
            let end = disposition.indexOf(';')
            if (end === -1) {
              end = disposition.length
            }
            disposition = disposition.substring(0, end).trim()
            fileName = disposition
          }
          const destination = this.getTempPath(createHash('sha1').update(url).digest('hex'), fileName)
          await ensureFile(destination)
          await this.submit(new DownloadTask({
            ...this.networkManager.getDownloadBaseOptions(),
            url: url,
            validator: typeof md5 === 'string'
              ? {
                hash: md5,
                algorithm: 'md5',
              }
              : undefined,
            destination,
          }))
          return { destination, fileName, url }
        }
      }
    }
  }
}
