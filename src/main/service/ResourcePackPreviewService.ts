import { Queue } from '@main/util/mutex';
import { MinecraftFolder } from '@xmcl/core';
import { ModelLoader, ResourceManager, ResourcePackWrapper } from '@xmcl/resource-manager';
import { ResourcePack } from '@xmcl/resourcepack';
import { join } from 'path';
import InstanceResourceService from './InstanceResourceService';
import Service, { Inject, MutationTrigger } from './Service';

export interface BlockStateJson {
    name: string;
    variants: {
        [variant: string]: {
            model: string;
        } | Array<{
            model: string;
        }>;
    };
}

export interface NamedResourcePackWrapper extends ResourcePackWrapper {
    path: string;
}

export default class ResourcePackPreviewService extends Service {
    @Inject('InstanceResourceService')
    private instanceResourceService!: InstanceResourceService;

    private resourceManager = new ResourceManager();

    private modelLoader = new ModelLoader(this.resourceManager);

    private cachedBlocks: BlockStateJson[] | undefined;

    private cachedJsonVersion: string | undefined;

    private queue = new Queue();

    private active = false;

    async init() {
        this.app.on('minecraft-start', () => {
            if (this.active) {
                this.queue.waitUntilEmpty().then(() => {
                    // deactivate once game started
                    this.active = false;
                    this.resourceManager.clear();
                    this.cachedBlocks = undefined;
                    this.cachedJsonVersion = undefined;
                    this.modelLoader = new ModelLoader(this.resourceManager);
                });
            }
        });
    }

    @MutationTrigger('instanceGameSettings')
    protected onGameSettingChanged(setting: { resourcePacks: string[] }) {
        if (!this.active) {
            return;
        }
        if (setting.resourcePacks) {
            this.updateResourcePacks(setting.resourcePacks);
        }
    }

    protected getResourcePackPath(pack: string) {
        if (pack === 'vanilla') {
            const version = this.getters.instanceVersion.folder;
            const jarPath = new MinecraftFolder(this.state.root).getVersionJar(version);
            return jarPath;
        }
        pack = pack.startsWith('file/') ? pack.substring(5) : pack;
        return join(this.state.instance.path, 'resourcepacks', pack);
    }

    protected async loadResourcePack(path: string) {
        const pack = await ResourcePack.open(path);
        const metadata = await this.resourceManager.addResourcePack(pack) as NamedResourcePackWrapper;
        metadata.path = path;
    }

    protected async updateResourcePacks(resourcePacks: string[]) {
        const release = await this.queue.waitInline();

        try {
            const list = this.resourceManager.list as NamedResourcePackWrapper[];

            const resourcePacksPaths = resourcePacks.map((name) => this.getResourcePackPath(name));
            if (resourcePacks.every((p) => p !== 'vanilla')) {
                resourcePacksPaths.unshift(this.getResourcePackPath('vanilla'));
            }

            await this.instanceResourceService.ensureResourcePacksDeployment();

            this.log(`Load resource packs to preview: [${resourcePacks.join(', ')}]`);
            // load the pack if the present
            if (resourcePacksPaths.length !== list.length
                || resourcePacksPaths.some((path, i) => list[i]?.path !== path)) {
                for (let i = 0; i < resourcePacksPaths.length; i++) {
                    const path = resourcePacksPaths[i];
                    const cached = list.find((e) => e.path === path);
                    if (!cached) {
                        // if not present, load from file
                        await this.loadResourcePack(path);
                        this.log(`Load new resource pack: ${path}`);
                    } else {
                        this.log(`Use cached resource pack: ${path}`);
                    }
                }
            } else {
                this.log('The resource pack content not changed');
            }

            // re-order the list
            const copy = [...list];
            if (resourcePacksPaths.some((path, i) => path !== list[i].path)) {
                for (let i = 0; i < resourcePacksPaths.length; i++) {
                    list[i] = copy.find((w) => w.path === resourcePacksPaths[i])!;
                }
            }
            const toRemove = copy.filter((v) => resourcePacksPaths.indexOf(v.path) === -1);
            // close redundent
            for (const pack of toRemove) {
                pack.source.fs.close();
            }
            this.log(`Release resource pack [${toRemove.join(', ')}]`);
            // remove redundent
            while (list.length > resourcePacksPaths.length) {
                list.pop();
            }
        } finally {
            release();
        }
    }

    async loadModel(modelPath: string) {
        this.log(`Load model ${modelPath}`);

        const model = await this.modelLoader.loadModel(modelPath);
        const textures: Record<string, { url: string }> = {};
        for (const [name, res] of Object.entries(this.modelLoader.textures)) {
            textures[name] = { url: `data:image/png;base64,${await res.read('base64')}` };
        }

        return { model, textures };
    }

    async getBlockStates(): Promise<BlockStateJson[]> {
        const gameVersion = this.getters.instanceVersion.folder;
        if (this.cachedJsonVersion === gameVersion && this.cachedBlocks) {
            // cache hit
            this.log(`Use cached ${this.cachedBlocks.length} blockstates from ${gameVersion}.jar`);
            return this.cachedBlocks;
        }

        this.active = true;

        if (this.resourceManager.list.length === 0) {
            // if no resource packs loaded, load it...
            if (!this.queue.isWaiting()) {
                await this.updateResourcePacks(this.state.instance.settings?.resourcePacks ?? { resourcePacks: [] });
            } else {
                await this.queue.waitUntilEmpty();
            }
        }

        const vanilla = this.resourceManager.list.find((w) => (w as NamedResourcePackWrapper).path.endsWith('.jar'))!;

        const fs = vanilla.source.fs;
        const files = await fs.listFiles('assets/minecraft/blockstates');
        const blocks = await Promise.all(files.map(async (file) => fs.readFile(`assets/minecraft/blockstates/${file}`)
            .then((b) => ({ ...JSON.parse(b.toString()), name: file } as BlockStateJson))));

        this.cachedBlocks = blocks;
        this.cachedJsonVersion = gameVersion;

        this.log(`Read ${blocks.length} blockstates from ${gameVersion}.jar`);
        return blocks;
    }
}
