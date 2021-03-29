import { unlink } from 'fs-extra'
import { join } from 'path'
import LauncherApp from '../app/LauncherApp'
import InstanceIOService from './InstanceIOService'
import InstanceResourceService from './InstanceResourceService'
import InstanceSavesService from './InstanceSavesService'
import ResourceService, { ParseResourceContext } from './ResourceService'
import AbstractService, { ExportService, Inject } from './Service'
import { ZipTask } from '/@main/util/zip'
import { isModpackResource, isModResource, isSaveResource } from '/@shared/entities/resource'
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
      await this.resourceService.importParsedResource(options, resolved, icon)
      await unlink(tempZipPath)
    }
    if (resolved.fileType === 'directory') {
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
          this.instanceResourcesService.deploy({ resources: [resolved], path: instancePath })
        } else if (isSaveResource(resolved)) {
          await this.instanceSaveService.importSave({
            instancePath,
            source: join(resolved.path, resolved.metadata.root),
          })
        }
      }
    } else {
      if (shouldImport) {
        await this.resourceService.importParsedResource(options, resolved, icon)
      }
      // if (installToInstance) {
      //   if (resolved.type === ResourceType.Modpack) {
      //     const tempDir = this.getTempPath(resolved.name)
      //     const zip = await open(path)
      //     const entries = await readAllEntries(zip)
      //     await new UnzipTask(zip, entries, tempDir).startAndWait()

      //     await this.instanceIOService.importInstance(tempDir)
      //     await remove(tempDir)
      //   }
      // }
      // if (resolved.domain === ResourceDomain.Modpacks && resolved.type === ResourceType.Modpack) {
      //   const tempDir = this.getTempPath(resolved.name)
      //   const zip = await open(path)
      //   const entries = await readAllEntries(zip)
      //   await new UnzipTask(zip, entries, tempDir).startAndWait()

      //   await this.instanceIOService.importInstance(tempDir)
      //   await remove(tempDir)
      // } else if (resolved.fileType === 'zip' || resolved.ext === '.jar') {
      //   result = await this.resourceService.importFile({ path, type })
      // }
    }
    // return result
  }
}
