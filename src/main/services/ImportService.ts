import { unlink } from 'fs-extra'
import { join } from 'path'
import LauncherApp from '../app/LauncherApp'
import InstanceGameSettingService from './InstanceGameSettingService'
import InstanceIOService from './InstanceIOService'
import InstanceResourceService from './InstanceResourceService'
import InstanceSavesService from './InstanceSavesService'
import ResourceService, { ParseResourceContext } from './ResourceService'
import AbstractService, { ExportService, Inject } from './Service'
import { ZipTask } from '/@main/util/zip'
import { isModpackResource, isModResource, isResourcePackResource, isSaveResource } from '/@shared/entities/resource'
import { ResourceDomain } from '/@shared/entities/resource.schema'
import { ImportFileOptions, ImportService as IImportService, ImportServiceKey } from '/@shared/services/ImportService'

@ExportService(ImportServiceKey)
export default class ImportService extends AbstractService implements IImportService {
  constructor(
    app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(InstanceIOService) private instanceIOService: InstanceIOService,
    @Inject(InstanceResourceService) private instanceResourcesService: InstanceResourceService,
    @Inject(InstanceSavesService) private instanceSaveService: InstanceSavesService,
    @Inject(InstanceGameSettingService) private instanceGameSettingService: InstanceGameSettingService,
  ) {
    super(app)
  }

  async importFile(options: ImportFileOptions): Promise<void> {
    const context: ParseResourceContext = {}
    const existed = await this.resourceService.queryExistedResourceByPath(options.path, context)
    if (existed) {
      return
      // return existed
    }
    const [resolved, icon] = await this.resourceService.resolveResource(options, context)
    const getInstancePath = (inst: string | boolean) => typeof inst === 'boolean' ? this.state.instance.path : inst
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
      const zipedContext: ParseResourceContext = {}
      const existed = await this.resourceService.queryExistedResourceByPath(tempZipPath, zipedContext)
      if (!existed) {
        const [resolvedZip] = await this.resourceService.resolveResource({ ...options, path: tempZipPath }, zipedContext)
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
          await this.instanceResourcesService.deploy({ resources: [resolved], path: instancePath })
        } else if (isSaveResource(resolved)) {
          await this.instanceSaveService.importSave({
            instancePath,
            source: join(resolved.path, resolved.metadata.root),
          })
        } else if (isResourcePackResource(resolved)) {
          await this.instanceResourcesService.deploy({ resources: [resolved], path: instancePath })
          if (instancePath !== this.state.instance.path) {
            const frame = await this.instanceGameSettingService.getInstanceGameSettings(instancePath)
            await this.instanceGameSettingService.edit({ ...frame, resourcePacks: [...(frame.resourcePacks || []), resolved.path] })
          } else {
            await this.instanceGameSettingService.edit({ resourcePacks: [...this.state.instanceGameSetting.resourcePacks, resolved.path] })
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
          await this.instanceResourcesService.deploy({ resources: [resolved], path: instancePath })
        } else if (isSaveResource(resolved)) {
          await this.instanceSaveService.importSave({
            instancePath,
            source: join(resolved.path, resolved.metadata.root),
          })
        } else if (isResourcePackResource(resolved)) {
          await this.instanceResourcesService.deploy({ resources: [resolved], path: instancePath })
          if (instancePath !== this.state.instance.path) {
            const frame = await this.instanceGameSettingService.getInstanceGameSettings(instancePath)
            await this.instanceGameSettingService.edit({ ...frame, resourcePacks: [...(frame.resourcePacks || []), resolved.path] })
          } else {
            await this.instanceGameSettingService.edit({ resourcePacks: [...this.state.instanceGameSetting.resourcePacks, resolved.path] })
          }
        }
      }
    }
    // return result
  }
}
