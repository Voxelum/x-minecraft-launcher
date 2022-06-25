import { DownloadTask } from '@xmcl/installer'
import { ImportFileOptions, ImportService as IImportService, ImportServiceKey, ImportUrlOptions, isModpackResource, isModResource, isResourcePackResource, isSaveResource, Resource, ResourceDomain } from '@xmcl/runtime-api'
import { createHash } from 'crypto'
import { ensureFile, unlink } from 'fs-extra'
import { basename, join } from 'path'
import { URL } from 'url'
import LauncherApp from '../app/LauncherApp'
import { parseSourceControlUrl } from '../util/sourceControlUrlParser'
import { ZipTask } from '../util/zip'
import { InstanceIOService } from './InstanceIOService'
import { InstanceModsService } from './InstanceModsService'
import { InstanceOptionsService } from './InstanceOptionsService'
import { InstanceSavesService } from './InstanceSavesService'
import { InstanceService } from './InstanceService'
import { ParseResourceContext, ResourceService } from './ResourceService'
import { AbstractService, Inject } from './Service'

export class ImportService extends AbstractService implements IImportService {
  constructor(
    app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(InstanceIOService) private instanceIOService: InstanceIOService,
    @Inject(InstanceModsService) private instanceModsService: InstanceModsService,
    @Inject(InstanceSavesService) private instanceSaveService: InstanceSavesService,
    @Inject(InstanceOptionsService) private instanceGameSettingService: InstanceOptionsService,
    @Inject(InstanceService) private instanceService: InstanceService,
  ) {
    super(app, ImportServiceKey)
  }

  async importFile(options: ImportFileOptions): Promise<void> {
    const context: ParseResourceContext = {}
    const existed = await this.resourceService.queryExistedResourceByPath(options.path, context)
    if (existed) {
      if (existed.domain !== ResourceDomain.Unknown) {
        // return existed
        return
      }
    }
    const [resolved, icon] = await this.resourceService.parseResource(options, context)
    const getInstancePath = (inst: string | boolean) => typeof inst === 'boolean' ? this.instanceService.state.path : inst
    const resolveOptions = () => {
      if (resolved.domain === ResourceDomain.Saves) {
        return {
          shouldImport: options.savePolicy?.import ?? false,
          installToInstance: options.savePolicy?.installToInstance ?? options.installToInstance ?? true,
        }
      }
      if (resolved.domain === ResourceDomain.Modpacks) {
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
      const tempZipPath = `${this.getTempPath(resolved.name)}.zip`
      const zipTask = new ZipTask(tempZipPath)
      await zipTask.includeAs(resolved.path, '')
      await zipTask.startAndWait()
      const zippedContext: ParseResourceContext = {}
      const existed = await this.resourceService.queryExistedResourceByPath(tempZipPath, zippedContext)
      if (!existed) {
        const [resolvedZip] = await this.resourceService.parseResource({ ...options, path: tempZipPath }, zippedContext)
        await this.resourceService.importParsedResource({ ...options, path: tempZipPath }, resolvedZip, icon)
      }
      await unlink(tempZipPath)
    }
    if (resolved.fileType === 'directory') {
      // the importing object is a folder
      if (shouldImport) {
        if (resolved.domain === ResourceDomain.ResourcePacks ||
          resolved.domain === ResourceDomain.Saves ||
          resolved.domain === ResourceDomain.Modpacks) {
          await packAndImport()
        }
        // TODO: handle mods and unknown
      }
      if (installToInstance) {
        if (isModpackResource(resolved)) {
          await this.instanceIOService.importInstance(resolved.metadata.root)
        } else if (isModResource(resolved)) {
          this.warn(`Deploy directory mod to instance ${instancePath}. This might not work!`)
          await this.instanceModsService.install({ mods: [resolved], path: instancePath })
        } else if (isSaveResource(resolved)) {
          await this.instanceSaveService.importSave({
            instancePath,
            source: join(resolved.path, resolved.metadata.root),
          })
        } else if (isResourcePackResource(resolved)) {
          if (instancePath !== this.instanceService.state.path) {
            const frame = await this.instanceGameSettingService.getGameOptions(instancePath)
            await this.instanceGameSettingService.editGameSetting({ ...frame, resourcePacks: [...(frame.resourcePacks || []), resolved.path] })
          } else {
            // TODO: fix this
            await this.instanceGameSettingService.editGameSetting({ resourcePacks: [...this.instanceGameSettingService.state.options.resourcePacks, resolved.path] })
          }
        }
      }
    } else {
      // the import object is a file
      if (shouldImport) {
        await this.resourceService.importParsedResource(options, resolved, icon)
      }
      if (installToInstance) {
        if (isModpackResource(resolved)) {
          await this.instanceIOService.importInstance(resolved.metadata.root)
        } else if (isModResource(resolved)) {
          await this.instanceModsService.install({ mods: [resolved], path: instancePath })
        } else if (isSaveResource(resolved)) {
          await this.instanceSaveService.importSave({
            instancePath,
            source: join(resolved.path, resolved.metadata.root),
          })
        } else if (isResourcePackResource(resolved)) {
          if (instancePath !== this.instanceService.state.path) {
            const frame = await this.instanceGameSettingService.getGameOptions(instancePath)
            await this.instanceGameSettingService.editGameSetting({ ...frame, resourcePacks: [...(frame.resourcePacks || []), resolved.path] })
          } else {
            // TODO: fix this
            // await this.instanceGameSettingService.editGameSetting({ resourcePacks: [...this.instanceGameSettingService.state.resourcePacks, resolved.path] })
          }
        }
      }
    }
    // return result
  }

  async previewUrl(options: ImportUrlOptions): Promise<Resource | undefined> {
    const result = await this.processUrl(options.url)

    if (result) {
      const [resource] = await this.resourceService.resolveResource({
        path: result.destination,
        url: [result.url, options.url],
      })
      return resource
    }

    return undefined
  }

  private async processUrl(url: string) {
    if (url.startsWith('https://github.com') || url.startsWith('https://gitlab.com')) {
      const resolved = new URL(url)
      if (resolved.pathname.endsWith('.jar') || resolved.pathname.endsWith('.mrpack') || resolved.pathname.endsWith('.zip')) {
        url = parseSourceControlUrl(url)
        const response = await this.networkManager.request.head(url)
        if (response.headers['content-type'] === 'application/octet-stream') {
          const md5 = response.headers['content-md5']
          let fileName = basename(url)
          if (response.headers['content-disposition'] && response.headers['content-disposition'].startsWith('attachment;')) {
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
