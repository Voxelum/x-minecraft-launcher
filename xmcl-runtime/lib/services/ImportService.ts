import { ImportFileOptions, ImportService as IImportService, ImportServiceKey, isModpackResource, isModResource, isResourcePackResource, isSaveResource, ResourceDomain } from '@xmcl/runtime-api'
import { unlink } from 'fs-extra'
import { join } from 'path'
import LauncherApp from '../app/LauncherApp'
import { ZipTask } from '../util/zip'
import InstanceIOService from './InstanceIOService'
import InstanceModsService from './InstanceModsService'
import InstanceOptionsService from './InstanceOptionsService'
import InstanceSavesService from './InstanceSavesService'
import InstanceService from './InstanceService'
import ResourceService, { ParseResourceContext } from './ResourceService'
import AbstractService, { ExportService, Inject } from './Service'

@ExportService(ImportServiceKey)
export default class ImportService extends AbstractService implements IImportService {
  constructor(
    app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(InstanceIOService) private instanceIOService: InstanceIOService,
    @Inject(InstanceModsService) private instanceModsService: InstanceModsService,
    @Inject(InstanceSavesService) private instanceSaveService: InstanceSavesService,
    @Inject(InstanceOptionsService) private instanceGameSettingService: InstanceOptionsService,
    @Inject(InstanceService) private instanceService: InstanceService,
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
      const zipedContext: ParseResourceContext = {}
      const existed = await this.resourceService.queryExistedResourceByPath(tempZipPath, zipedContext)
      if (!existed) {
        const [resolvedZip] = await this.resourceService.parseResource({ ...options, path: tempZipPath }, zipedContext)
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
}
