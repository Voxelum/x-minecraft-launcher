import { mutateResource } from '@main/entities/resource';
import { readdirIfPresent } from '@main/util/fs';
import { isModResource, isResourcePackResource, ModResource, Resource, ResourcePackResource } from '@universal/entities/resource';
import { ResourceDomain } from '@universal/entities/resource.schema';
import { copyFile, ensureDir, FSWatcher, link, unlink } from 'fs-extra';
import debounce from 'lodash.debounce';
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

    private addModQueue: ModResource[] = [];

    private removeModQueue: ModResource[] = [];

    private addResourcePackQueue: ResourcePackResource[] = [];

    private removeResourcePackQueue: ResourcePackResource[] = [];

    private commitUpdate = debounce(() => {
        if (this.addModQueue.length > 0) {
            this.commit('instanceModAdd', this.addModQueue);
            this.addModQueue = [];
        }
        if (this.removeModQueue.length > 0) {
            this.commit('instanceModRemove', this.removeModQueue);
            this.removeModQueue = [];
        }
        if (this.addResourcePackQueue.length > 0) {
            this.commit('instanceResourcepackAdd', this.addResourcePackQueue);
            this.addResourcePackQueue = [];
        }
        if (this.removeResourcePackQueue.length > 0) {
            this.commit('instanceResourcepackRemove', this.removeResourcePackQueue);
            this.removeResourcePackQueue = [];
        }
    }, 1000);

    private async scanMods() {
        const instance = this.getters.instance;
        const dir = join(instance.path, 'mods');
        const files = await readdirIfPresent(dir);

        const fileArgs = files.filter((file) => !file.startsWith('.')).map((file) => ({
            path: join(dir, file),
            url: [] as string[],
            source: undefined,
        }));
        const resources = await this.resourceService.importResources({
            files: fileArgs,
            fromDomain: ResourceDomain.Mods,
            type: 'mod',
        });
        return resources.map((r, i) => mutateResource(r, (r) => { r.path = fileArgs[i].path; }))
            .filter(isModResource);
    }

    private async scanResourcepacks() {
        const instance = this.getters.instance;
        const dir = join(instance.path, 'resourcepacks');
        const files = await readdirIfPresent(dir);

        const fileArgs = files.filter((file) => !file.startsWith('.')).map((file) => ({
            path: join(dir, file),
            url: [] as string[],
            source: undefined,
        }));

        const resources = await this.resourceService.importResources({
            files: fileArgs,
            fromDomain: ResourceDomain.ResourcePacks,
            type: 'resourcepack',
        });
        return resources.map((r, i) => mutateResource(r, (r) => { r.path = fileArgs[i].path; }))
            .filter(isResourcePackResource);
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
            await this.resourceService.whenModsReady();
            this.commit('instanceMods', await this.scanMods());
            this.modsWatcher = watch(basePath, (event, name) => {
                if (name.startsWith('.')) return;
                let filePath = name;
                if (event === 'update') {
                    this.resourceService.importResource({ path: filePath, type: 'mods', background: true }).then((resource) => {
                        if (isModResource(resource)) {
                            this.log(`Instace mod add ${filePath}`);
                            this.addModQueue.push(mutateResource(resource, (r) => { r.path = filePath; }));
                            this.commitUpdate();
                        } else {
                            this.warn(`Non mod resource added in /mods directory! ${filePath}`);
                        }
                    });
                } else {
                    const target = this.state.instance.mods.find(r => r.path === filePath);
                    if (target) {
                        this.log(`Instace mod remove ${filePath}`);
                        this.removeModQueue.push(target);
                        this.commitUpdate();
                    } else {
                        this.warn(`Cannot remove the mod ${filePath} as it's not found in memory cache!`);
                    }
                }
            });
            this.log(`Mounted on instance mods: ${basePath}`);
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
            await this.resourceService.whenResourcePacksReady();
            this.commit('instanceResourcepacks', await this.scanResourcepacks());
            this.resourcepacksWatcher = watch(basePath, (event, name) => {
                if (name.startsWith('.')) return;
                let filePath = name;
                if (event === 'update') {
                    this.resourceService.importResource({ path: filePath, type: 'resourcepacks' }).then((resource) => {
                        if (isResourcePackResource(resource)) {
                            this.log(`Instace resource pack add ${filePath}`);
                            this.addResourcePackQueue.push(mutateResource(resource, (r) => { r.path = filePath; }));
                            this.commitUpdate();
                        } else {
                            this.warn(`Non resource pack resource added in /resourcepacks directory! ${filePath}`);
                        }
                    });
                } else {
                    const target = this.state.instance.resourcepacks.find(r => r.path === filePath);
                    if (target) {
                        this.log(`Instace resource pack remove ${filePath}`);
                        this.removeResourcePackQueue.push(target);
                        this.commitUpdate();
                    } else {
                        this.warn(`Cannot remove the resource pack ${filePath} as it's not found in memory cache!`);
                    }
                }
            });
            this.log(`Mounted on instance resource packs: ${basePath}`);
        }
    }

    async deploy({ resources, path = this.state.instance.path }: DeployOptions) {
        let promises: Promise<void>[] = [];
        if (!path) {
            path = this.state.instance.path;
        }
        if (!this.state.instance.all[path]) {
            this.warn(`Cannot deploy to the instance ${path}, as it's not found!`);
            path = this.state.instance.path;
        }
        this.log(`Deploy ${resources.length} to ${path}`);
        for (let resource of resources) {
            if (resource.domain !== ResourceDomain.Mods && resource.domain !== ResourceDomain.ResourcePacks) {
                this.warn(`Skip to deploy ${resource.name} as it's not a mod or resourcepack`);
            } else {
                const src = join(this.state.root, resource.location + resource.ext);
                const dest = join(path, resource.location + resource.ext);
                promises.push(link(src, dest).catch(() => copyFile(src, dest)));
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
        this.log(`Undeploy ${resources.length} from ${this.state.instance.path}`);
        const promises: Promise<void>[] = [];
        const path = this.state.instance.path;
        for (const resource of resources) {
            if (resource.domain !== ResourceDomain.Mods && resource.domain !== ResourceDomain.ResourcePacks) {
                this.warn(`Skip to undeploy ${resource.name} as it's not a mod or resourcepack`);
            } else {
                const dest = join(path, resource.location + resource.ext);
                promises.push(unlink(dest));
            }
        }
        await Promise.all(promises);
    }
}
