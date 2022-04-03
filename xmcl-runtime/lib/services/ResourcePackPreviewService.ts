import { MinecraftFolder } from '@xmcl/core'
import { ModelLoader, ResourceManager, ResourcePack, ResourcePackWrapper } from '@xmcl/resourcepack'
import { BlockStateJson, ResourcePackPreviewService as IResourcePackPreviewService, ResourcePackPreviewServiceKey } from '@xmcl/runtime-api'
import { join } from 'path'
import LauncherApp from '../app/LauncherApp'
import { Queue } from '../util/mutex'
import InstanceOptionsService from './InstanceOptionsService'
import InstanceResourcePackService from './InstanceResourcePacksService'
import InstanceService from './InstanceService'
import InstanceVersionService from './InstanceVersionService'
import LaunchService from './LaunchService'
import AbstractService, { ExportService, Inject, Subscribe } from './Service'

interface NamedResourcePackWrapper extends ResourcePackWrapper {
  path: string
}

@ExportService(ResourcePackPreviewServiceKey)
export default class ResourcePackPreviewService extends AbstractService implements IResourcePackPreviewService {
  private resourceManager = new ResourceManager()

  private modelLoader = new ModelLoader(this.resourceManager)

  private cachedBlocks: BlockStateJson[] | undefined

  private cachedJsonVersion: string | undefined

  private queue = new Queue()

  private active = false

  constructor(app: LauncherApp,
    @Inject(InstanceResourcePackService) private instanceResourceService: InstanceResourcePackService,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(InstanceVersionService) private instanceVersionService: InstanceVersionService,
    @Inject(InstanceOptionsService) private instanceGameSettingService: InstanceOptionsService,
    @Inject(LaunchService) private launchService: LaunchService,
  ) {
    super(app)
    launchService.on('minecraft-start', () => {
      if (this.active) {
        this.queue.waitUntilEmpty().then(() => {
          // deactivate once game started
          this.active = false
          this.resourceManager.clear()
          this.cachedBlocks = undefined
          this.cachedJsonVersion = undefined
          this.modelLoader = new ModelLoader(this.resourceManager)
        })
      }
    })
  }

  @Subscribe('instanceGameSettings')
  protected onGameSettingChanged(setting: { resourcePacks: string[] }) {
    if (!this.active) {
      return
    }
    if (setting.resourcePacks) {
      this.updateResourcePacks(setting.resourcePacks)
    }
  }

  protected getResourcePackPath(pack: string) {
    if (pack === 'vanilla') {
      const version = this.instanceVersionService.getInstanceVersion().minecraftVersion
      const jarPath = new MinecraftFolder(this.getPath()).getVersionJar(version)
      return jarPath
    }
    pack = pack.startsWith('file/') ? pack.substring(5) : pack
    return join(this.instanceService.state.path, 'resourcepacks', pack)
  }

  protected async loadResourcePack(path: string) {
    const pack = await ResourcePack.open(path)
    const metadata = await this.resourceManager.addResourcePack(pack) as NamedResourcePackWrapper
    metadata.path = path
  }

  protected async updateResourcePacks(resourcePacks: string[]) {
    const release = await this.queue.waitInline()

    try {
      const list = this.resourceManager.list as NamedResourcePackWrapper[]

      const resourcePacksPaths = resourcePacks.map((name) => this.getResourcePackPath(name))
      if (resourcePacks.every((p) => p !== 'vanilla')) {
        resourcePacksPaths.unshift(this.getResourcePackPath('vanilla'))
      }

      this.log(`Load resource packs to preview: [${resourcePacks.join(', ')}]`)
      // load the pack if the present
      if (resourcePacksPaths.length !== list.length ||
        resourcePacksPaths.some((path, i) => list[i]?.path !== path)) {
        for (let i = 0; i < resourcePacksPaths.length; i++) {
          const path = resourcePacksPaths[i]
          const cached = list.find((e) => e.path === path)
          if (!cached) {
            // if not present, load from file
            await this.loadResourcePack(path)
            this.log(`Load new resource pack: ${path}`)
          } else {
            this.log(`Use cached resource pack: ${path}`)
          }
        }
      } else {
        this.log('The resource pack content not changed')
      }

      // re-order the list
      const copy = [...list]
      if (resourcePacksPaths.some((path, i) => path !== list[i].path)) {
        for (let i = 0; i < resourcePacksPaths.length; i++) {
          list[i] = copy.find((w) => w.path === resourcePacksPaths[i])!
        }
      }
      const toRemove = copy.filter((v) => resourcePacksPaths.indexOf(v.path) === -1)
      // close redundent
      for (const pack of toRemove) {
        pack.source.fs.close()
      }
      this.log(`Release resource pack [${toRemove.join(', ')}]`)
      // remove redundent
      while (list.length > resourcePacksPaths.length) {
        list.pop()
      }
    } finally {
      release()
    }
  }

  async loadModel(modelPath: string) {
    this.log(`Load model ${modelPath}`)

    const model = await this.modelLoader.loadModel(modelPath)
    const textures: Record<string, { url: string }> = {}
    for (const [name, res] of Object.entries(this.modelLoader.textures)) {
      textures[name] = { url: `data:image/png;base64,${await res.read('base64')}` }
    }

    return { model, textures }
  }

  async getBlockStates(): Promise<BlockStateJson[]> {
    const gameVersion = this.instanceVersionService.getInstanceVersion().id
    if (this.cachedJsonVersion === gameVersion && this.cachedBlocks) {
      // cache hit
      this.log(`Use cached ${this.cachedBlocks.length} blockstates from ${gameVersion}.jar`)
      return this.cachedBlocks
    }

    this.active = true

    if (this.resourceManager.list.length === 0) {
      // if no resource packs loaded, load it...
      if (!this.queue.isWaiting()) {
        // TODO: fix this
        // await this.updateResourcePacks(this.instanceGameSettingService.state.resourcePacks)
      } else {
        await this.queue.waitUntilEmpty()
      }
    }

    const vanilla = this.resourceManager.list.find((w) => (w as NamedResourcePackWrapper).path.endsWith('.jar'))!

    const fs = vanilla.source.fs
    const files = await fs.listFiles('assets/minecraft/blockstates')
    const blocks = await Promise.all(files.map(async (file) => fs.readFile(`assets/minecraft/blockstates/${file}`)
      .then((b) => ({ ...JSON.parse(b.toString()), name: file } as BlockStateJson))))

    this.cachedBlocks = blocks
    this.cachedJsonVersion = gameVersion

    this.log(`Read ${blocks.length} blockstates from ${gameVersion}.jar`)
    return blocks
  }
}
