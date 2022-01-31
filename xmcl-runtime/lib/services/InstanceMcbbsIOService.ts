import { EditInstanceOptions, McbbsModpackManifest, ModpackFile, PersistedResource, ResourceDomain, write } from '@xmcl/runtime-api'
import { open, readAllEntries, readEntry } from '@xmcl/unzip'
import { LauncherApp } from '..'
import { installMcbbsModpackTask } from '../entities/mcbbsModpack'
import InstanceModsService from './InstanceModsService'
import InstanceOptionsService from './InstanceOptionsService'
import InstanceService from './InstanceService'
import ResourceService from './ResourceService'
import AbstractService, { Inject } from './Service'
import VersionService from './VersionService'

export interface ImportMcbbsModpackOptions {
  /**
   * The path of the modpack
   */
  path: string
  /**
   * Should download from file api
   */
  allowFileApi?: boolean
}

export interface ExportMcbbsModpackOptions {
  /**
   * The src path of the instance
   */
  src?: string

  /**
   * The dest path of the exported instance
   */
  destinationPath: string

  /**
   * If this is present, it will only exports the file paths in this array.
   * By default this is `undefined`, and it will export everything in the instance.
   */
  files?: string[]
}

export class InstanceMcbbsModpackService extends AbstractService {
  constructor(app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(VersionService) private versionService: VersionService,
    @Inject(InstanceModsService) private instanceModsService: InstanceModsService,
    @Inject(InstanceOptionsService) private instanceOptionsService: InstanceOptionsService,
  ) {
    super(app)
  }

  async importModpack(options: ImportMcbbsModpackOptions) {
    const file = options.path
    const zip = await open(file)
    const entries = await readAllEntries(zip)
    const manifestEntry = entries.find(e => e.fileName === 'mcbbs.packmeta')
    if (!manifestEntry) {
      // TODO: optimize the error
      throw new Error('Mailfrom mcbbs modpack!')
    }
    const manifest = await readEntry(zip, manifestEntry).then(b => JSON.parse(b.toString()) as McbbsModpackManifest)

    const config: EditInstanceOptions = {
      runtime: {
        minecraft: manifest.addons.find(a => a.id === 'game')?.version ?? '',
        forge: manifest.addons.find(a => a.id === 'forge')?.version ?? '',
        liteloader: '',
        fabricLoader: manifest.addons.find(a => a.id === 'fabric')?.version ?? '',
        yarn: '',
      },
      description: manifest.description,
      author: manifest.author,
      version: manifest.version,
      name: manifest.name,
      url: manifest.url,
    }

    const instancePath = await this.instanceService.createInstance(config)

    const lock = this.semaphoreManager.getLock(write(instancePath))
    await lock.write(async () => {
      if (manifest.files && manifest.files.length > 0) {
        const existedResources: PersistedResource[] = []
        const missingFiles: ModpackFile[] = []

        for (const file of manifest.files) {
          const existedResource = file.type === 'curse'
            ? this.resourceService.getResource({ url: `curseforge://id/${file.projectID}/${file.fileID}` })
            : this.resourceService.getResource({ hash: file.hash })

          if (existedResource) {
            if (existedResource.domain === ResourceDomain.Mods) {
              // only mod need to deploy
              existedResources.push(existedResource)
            } else if (existedResource.domain !== ResourceDomain.Unknown) {
              this.log(file.type === 'curse'
                ? `Skip to import existed resource in ${existedResource.domain} for curseforge project ${file.projectID} file ${file.fileID}`
                : `Skip to import existed resource in ${existedResource.domain} for addon file ${file.path} ${file.hash}`,
              )
            } else {
              missingFiles.push(file)
            }
          } else {
            missingFiles.push(file)
          }
        }

        // only download missing file
        manifest.files = missingFiles

        // install existed resources
        await this.instanceModsService.install({ mods: existedResources, path: instancePath })
      }

      // install all missing files
      await this.submit(installMcbbsModpackTask({ path: file, destination: instancePath, manifest, allowCustomFile: options.allowFileApi }))
    })
  }

  async exportModpack(options: ExportMcbbsModpackOptions) {

  }
}
