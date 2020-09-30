import { mutateResource } from '@main/entities/resource';
import { readdirIfPresent } from '@main/util/fs';
import { isModResource, isResourcePackResource, ModResource, Resource, ResourcePackResource, Resources } from '@universal/entities/resource';
import { copyFile, ensureDir, FSWatcher, link, unlink } from 'fs-extra';
import watch from 'node-watch';
import { basename, join } from 'path';
import ResourceService from './ResourceService';
import Service, { Inject, MutationTrigger, Singleton } from './Service';

export interface DeployOptions {
    resources: Resource[];
    /**
     * The instance path to deploy. This will be the current path by default.
     */
    path?: string;
}

/**
 * Provide the abilities to import mods and resource packs files to instance
 */
export default class InstanceResourceService extends Service {
    @Inject('ResourceService')
    private resourceService!: ResourceService;

    private watchingMods = '';

    private modsWatcher: FSWatcher | undefined;

    private watchingResourcePack = '';

    private resourcepacksWatcher: FSWatcher | undefined;

    private async scanMods() {
        const instance = this.getters.instance;
        const dir = join(instance.path, 'mods');
        const files = await readdirIfPresent(dir);

        const fileArgs = files.filter((file) => !file.startsWith('.')).map((file) => ({
            path: join(dir, file),
            url: [] as string[],
            source: undefined,
            type: 'mod',
        }));
        const resources: ModResource[] = [];
        const existedResources: ModResource[] = [];
        await Promise.all(fileArgs.map(async (options) => {
            const existedResource = await this.resourceService.queryExistedResourceByPath(options.path);
            if (!existedResource) {
                const newResource = await this.resourceService.resolveResourceTask(options).execute().wait();
                if (isModResource(newResource)) {
                    resources.push(mutateResource(newResource, (r) => { r.path = options.path; }));
                } else {
                    this.error(`Non-mod resource found in /mods directory at ${options.path} type=${newResource.type}`);
                }
            } else if (isModResource(existedResource)) {
                existedResources.push(existedResource);
            } else {
                this.error(`Non-mod resource found in /mods directory at ${options.path} type=${existedResource.type}`);
            }
        }));
        this.resourceService.addResource(resources);
        this.log(`Found ${resources.length} in instance /mods. ${resources.length} new resources and ${existedResources.length} existed resources.`);
        return resources.concat(existedResources).map((r) => Object.freeze({ ...r, instancePath: instance.path }));
    }

    private async scanResourcepacks() {
        const instance = this.getters.instance;
        const dir = join(instance.path, 'resourcepacks');
        const files = await readdirIfPresent(dir);

        const fileArgs = files.filter((file) => !file.startsWith('.')).map((file) => ({
            path: join(dir, file),
            url: [] as string[],
            source: undefined,
            type: 'resourcepack',
        }));
        const resources: ResourcePackResource[] = [];
        const existedResources: ResourcePackResource[] = [];
        await Promise.all(fileArgs.map(async (options) => {
            const existedResource = await this.resourceService.queryExistedResourceByPath(options.path);
            if (!existedResource) {
                const newResource = await this.resourceService.resolveResourceTask(options).execute().wait();
                if (isResourcePackResource(newResource)) {
                    resources.push(mutateResource(newResource, (r) => { r.path = options.path; }));
                } else {
                    this.error(`Non-resourcepack resource found in /resourcepacks directory at ${options.path} type=${newResource.type}`);
                }
            } else if (isResourcePackResource(existedResource)) {
                existedResources.push(existedResource);
            } else {
                this.error(`Non-resourcepack resource found in /resourcepacks directory at ${options.path} type=${existedResource.type}`);
            }
        }));
        this.resourceService.addResource(resources);
        this.log(`Found ${resources.length} in instance /resourcepacks. ${resources.length} new resources and ${existedResources.length} existed resources.`);
        return resources.concat(existedResources).map((r) => Object.freeze({ ...r, instancePath: instance.path }));
    }

    @MutationTrigger('instanceSelect')
    protected onInstance() {
        this.mountModResources();
        this.mountResourcepacks();
    }

    async init() {
        this.mountModResources();
        this.mountResourcepacks();
    }

    async dispose() {
        if (this.modsWatcher) {
            this.modsWatcher.close();
        }
        if (this.resourcepacksWatcher) {
            this.resourcepacksWatcher.close();
        }
    }

    /**
     * Read all mods under the current instance
     */
    @Singleton()
    async mountModResources(): Promise<void> {
        let basePath = join(this.state.instance.path, 'mods');

        if (this.watchingMods !== basePath || !this.modsWatcher) {
            if (this.modsWatcher) {
                this.modsWatcher.close();
            }
            this.watchingMods = basePath;
            await ensureDir(basePath);
            this.commit('instanceMods', await this.scanMods());
            this.modsWatcher = watch(basePath, (event, name) => {
                if (name.startsWith('.')) return;
                let filePath = name;
                if (event === 'update') {
                    this.resourceService.importResource({ path: filePath, type: 'mods', background: true }).then((resource) => {
                        this.log(`Instace mod add ${filePath}`);
                        this.commit('instanceModAdd', { ...resource, filePath });
                    });
                } else {
                    this.log(`Instace mod remove ${filePath}`);
                    this.commit('instanceModRemove', this.state.instance.mods.find(r => r.path === filePath));
                }
            });
            this.log(`Mount on instance mods: ${basePath}`);
        }
    }

    @Singleton()
    async mountResourcepacks(): Promise<void> {
        let basePath = join(this.state.instance.path, 'resourcepacks');

        if (this.watchingResourcePack !== basePath || !this.resourcepacksWatcher) {
            if (this.resourcepacksWatcher) {
                this.resourcepacksWatcher.close();
            }
            this.watchingResourcePack = basePath;
            await ensureDir(basePath);
            this.commit('instanceResourcepacks', await this.scanResourcepacks());
            this.resourcepacksWatcher = watch(basePath, (event, name) => {
                if (name.startsWith('.')) return;
                let filePath = name;
                if (event === 'update') {
                    this.resourceService.importResource({ path: filePath, type: 'resourcepacks' }).then((resource) => {
                        this.log(`Instace resource pack add ${filePath}`);
                        this.commit('instanceResourcepackAdd', { ...resource, filePath });
                    });
                } else {
                    this.log(`Instace resource pack remove ${filePath}`);
                    this.commit('instanceResourcepackRemove', this.state.instance.resourcepacks.find(r => r.path === filePath));
                }
            });
            this.log(`Mount on instance resource packs: ${basePath}`);
        }
    }

    async deploy({ resources, path = this.state.instance.path }: DeployOptions) {
        let promises: Promise<void>[] = [];
        this.log(`Deploy ${resources.length} to ${path}`);
        for (let resource of resources) {
            if (resource.domain === 'modpacks') {
                this.warn(`Skip to deploy ${resource.name} as it's a modpack`);
            } else {
                const resourcePath = join(path, resource.domain, basename(resource.path));
                promises.push(link(resource.path, resourcePath).catch(() => copyFile(resource.path, resourcePath)));
            }
        }
        await Promise.all(promises);
    }

    async ensureResourcePacksDeployment() {
        const allPacks = this.state.resource.domains.resourcepacks;
        const deploiedPacks = this.state.instance.resourcepacks;

        const toBeDeploiedPacks = allPacks.filter(p => !deploiedPacks.find((r) => r.hash === p.hash));
        this.log(`Deploying ${toBeDeploiedPacks.length} resource packs`);

        await this.deploy({ resources: toBeDeploiedPacks });
    }

    async undeploy(resources: Resource[]) {
        this.log(`Undeploy ${resources.length} to ${this.state.instance.path}`);
        await Promise.all(resources.map(r => unlink(r.path)));
    }
}
