import { ImportService as IImportService, ImportServiceKey, ImportUrlOptions, Resource } from '@xmcl/runtime-api'
import { Inject, LauncherAppKey } from '~/app'
import { ResourceManager } from '~/resource'
import { AbstractService, ExposeServiceKey } from '~/service'
import { TaskFn, kTaskExecutor } from '~/task'
import { LauncherApp } from '../app/LauncherApp'

@ExposeServiceKey(ImportServiceKey)
export class ImportService extends AbstractService implements IImportService {
  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kTaskExecutor) private submit: TaskFn,
    @Inject(ResourceManager) private resourceManager: ResourceManager,
  ) {
    super(app)
  }

  async previewUrl(options: ImportUrlOptions): Promise<Resource | undefined> {
    // const result = await this.processUrl(options.url)

    // if (result) {
    //   const resources = await this.resourceManager.getResourcesByUris([result.url, options.url])
    //   let resource = resources[0] || resources[1]
    //   if (!resource) {
    //     const resolved = await this.resourceManager.resolveResources([{
    //       path: result.destination,
    //     }])
    //     resource = resolved[0]
    //   }
    //   return resource
    // }

    return undefined
  }

  private async processUrl(url: string) {
    // if (url.startsWith('https://github.com') || url.startsWith('https://gitlab.com')) {
    //   const resolved = new URL(url)
    //   if (resolved.pathname.endsWith('.jar') || resolved.pathname.endsWith('.mrpack') || resolved.pathname.endsWith('.zip')) {
    //     url = parseSourceControlUrl(url)
    //     const response = await request(url, { method: 'HEAD' })
    //     if (response.headers['content-type'] === 'application/octet-stream') {
    //       const md5 = response.headers['content-md5']
    //       let fileName = basename(url)
    //       if (response.headers['content-disposition'] && typeof response.headers['content-disposition'] === 'string' && response.headers['content-disposition'].startsWith('attachment;')) {
    //         let disposition = response.headers['content-disposition']
    //         const start = disposition.indexOf('filename=')
    //         disposition = disposition.substring(start)
    //         let end = disposition.indexOf(';')
    //         if (end === -1) {
    //           end = disposition.length
    //         }
    //         disposition = disposition.substring(0, end).trim()
    //         fileName = disposition
    //       }
    //       const getTemp = await this.app.registry.get(kTempDataPath)
    //       const destination = getTemp(createHash('sha1').update(url).digest('hex'), fileName)
    //       await ensureFile(destination)
    //       const downloadOptions = await this.app.registry.get(kDownloadOptions)
    //       await this.submit(new DownloadTask({
    //         ...downloadOptions,
    //         url,
    //         validator: typeof md5 === 'string'
    //           ? {
    //             hash: md5,
    //             algorithm: 'md5',
    //           }
    //           : undefined,
    //         destination,
    //       }))
    //       return { destination, fileName, url }
    //     }
    //   }
    // }
  }
}
