import { Fabric, FileSystem, Forge, System, Task, Util, WorldReader } from '@xmcl/minecraft-launcher-core';
import { createHash } from 'crypto';
import filenamify from 'filenamify';
import { fs, requireString } from 'main/utils';
import { getPersistence } from 'main/utils/persistence';
import ResourceConfig from 'main/utils/schema/ResourceConfig.json';
import { basename, extname, join, resolve } from 'path';
import { AnyResource, ImportOption, ImportTypeHint, Resource } from 'universal/store/modules/resource';
import CurseForgeService from './CurseForgeService';
import InstanceService from './InstanceService';
import Service, { Inject } from './Service';

function sha1(data: Buffer) {
    return createHash('sha1').update(data).digest('hex');
}
interface ResourceBuilder extends AnyResource {
    icon?: Uint8Array;
}
function toBuilder(resource: Readonly<AnyResource>): ResourceBuilder {
    return { ...resource };
}
function toResource(builder: ResourceBuilder): AnyResource {
    const res = { ...builder };
    delete res.icon;
    return res;
}

export function importResourceTask(path: string, type: ImportTypeHint | undefined, metadata: any) {
    async function importResource(this: ResourceService, context: Task.Context) {
        context.update(0, 4, path);
        const isDirectory = await fs.stat(path).then(stat => stat.isDirectory());
        if (isDirectory) throw new Error('Directory');
        const data: Buffer = await fs.readFile(path);
        const builder: Resource<any> = {
            name: '',
            path,
            hash: await Util.computeChecksum(path, 'sha1'),
            ext: extname(path),
            domain: '',
            type: '',
            metadata: {},
            source: {
                path: '',
                date: '',
            },
        };
        builder.name = basename(path, builder.ext);
        builder.source = {
            name: builder.name,
            path: resolve(path),
            date: Date.now(),
            ...metadata,
        };

        // check the resource existence
        context.update(1, 4, path);
        const checking = async () => {
            // TODO: do a more strict check
            const resource = this.getters.getResource(builder.hash);
            if (resource) {
                Object.assign(builder, resource, { source: builder.source });
                return true;
            }
            return false;
        };
        const existed = await context.execute(checking);

        if (!existed) {
            // use parser to parse metadata
            context.update(2, 4, path);
            const parsing = () => this.resolveResource(builder, data || path, type);
            await context.execute(parsing);
            console.log(`Imported resource ${builder.name}${builder.ext}(${builder.hash}) into ${builder.domain}`);

            // write resource to disk
            context.update(3, 4, path);
            const storing = () => this.commitResourceToDisk(builder, data);
            await context.execute(storing);

            // done
            context.update(4, 4, path);
        }
        const reuslt = toResource(builder);
        this.commit('resource', reuslt);
        return reuslt;
    }
    return importResource;
}

export interface ResourceRegistryEntry<T> {
    type: string;
    domain: string;
    ext: string;
    parseIcon: (metadata: T, data: FileSystem) => Promise<Uint8Array | undefined>;
    parseMetadata: (data: FileSystem) => Promise<T>;
    getSuggestedName: (metadata: T) => string;
}

export default class ResourceService extends Service {
    @Inject('InstanceService')
    private instanceSerivce!: InstanceService;

    @Inject('CurseForgeService')
    private curseforgeSerivce!: CurseForgeService;

    private hashToFilePath: { [hash: string]: string } = {};

    private resourceRegistry: ResourceRegistryEntry<any>[] = [];

    private unknownEntry: ResourceRegistryEntry<unknown> = {
        type: 'unknown',
        domain: 'unknowns',
        ext: '*',
        parseIcon: () => Promise.resolve(undefined),
        parseMetadata: () => Promise.resolve({}),
        getSuggestedName: () => '',
    };

    constructor() {
        super();
        this.register({
            type: 'forge',
            domain: 'mods',
            ext: '.jar',
            parseIcon: async (meta, fs) => {
                if (!meta || !meta.logoFile) { return undefined; }
                return fs.readFile(meta.logoFile);
            },
            parseMetadata: fs => Forge.readModMetaData(fs),
            getSuggestedName: (meta) => {
                let name = '';
                if (meta && meta.length > 0) {
                    meta = meta[0];
                    if (typeof meta.name === 'string' || typeof meta.modid === 'string') {
                        name += (meta.name || meta.modid);
                        if (typeof meta.mcversion === 'string') {
                            name += `-${meta.mcversion}`;
                        }
                        if (typeof meta.version === 'string') {
                            name += `-${meta.version}`;
                        }
                    }
                }
                return name;
            },
        });
        this.register({
            type: 'liteloader',
            domain: 'mods',
            ext: '.litemod',
            parseIcon: async () => undefined,
            parseMetadata: fs => fs.readFile('litemod.json', 'utf-8').then(JSON.parse),
            getSuggestedName: (meta) => {
                let name = '';
                if (typeof meta.name === 'string') {
                    name += meta.name;
                }
                if (typeof meta.mcversion === 'string') {
                    name += `-${meta.mcversion}`;
                }
                if (typeof meta.version === 'string') {
                    name += `-${meta.version}`;
                }
                if (typeof meta.revision === 'string' || typeof meta.revision === 'number') {
                    name += `-${meta.revision}`;
                }
                return name;
            },
        });
        this.register({
            type: 'fabric',
            domain: 'mods',
            ext: '.jar',
            parseIcon: async (meta, fs) => {
                if (meta.icon) {
                    return fs.readFile(meta.icon);
                }
                return Promise.resolve(undefined);
            },
            parseMetadata: async fs => Fabric.readModMetaData(fs),
            getSuggestedName: (meta) => {
                let name = '';
                if (typeof meta.name === 'string') {
                    name += meta.name;
                } else if (typeof meta.id === 'string') {
                    name += meta.id;
                }
                if (typeof meta.version === 'string') {
                    name += `-${meta.version}`;
                } else {
                    name += '-0.0.0';
                }
                return name;
            },
        });
        this.register({
            type: 'resourcepack',
            domain: 'resourcepacks',
            ext: '.zip',
            parseIcon: async (meta, fs) => fs.readFile('icon.png'),
            parseMetadata: fs => fs.readFile('pack.mcmeta', 'utf-8').then(JSON.parse),
            getSuggestedName: () => '',
        });
        this.register({
            type: 'save',
            domain: 'saves',
            ext: '.zip',
            parseIcon: async (meta, fs) => fs.readFile('icon.png'),
            parseMetadata: fs => new WorldReader(fs).getLevelData(),
            getSuggestedName: meta => meta.LevelName,
        });
        this.register({
            type: 'curseforge-modpack',
            domain: 'modpacks',
            ext: '.zip',
            parseIcon: () => Promise.resolve(undefined),
            parseMetadata: fs => fs.readFile('mainifest.json', 'utf-8').then(JSON.parse),
            getSuggestedName: () => '',
        });
    }

    private normalizeResource(resource: string | AnyResource) {
        return typeof resource === 'string' ? this.getters.getResource(resource) : resource;
    }

    protected register(entry: ResourceRegistryEntry<any>) {
        if (this.resourceRegistry.find(r => r.type === entry.type)) {
            throw new Error(`The entry type ${entry.type} existed!`);
        }
        this.resourceRegistry.push(entry);
    }

    protected async resolveResource(builder: ResourceBuilder, data: Buffer, typeHint?: ImportTypeHint): Promise<void> {
        let chains: Array<ResourceRegistryEntry<any>> = [];
        const fs = await System.openFileSystem(data);

        const hint = typeHint || '';
        if (hint === '*' || hint === '') {
            chains = this.resourceRegistry.filter(r => r.ext === builder.ext);
        } else {
            chains = this.resourceRegistry.filter(r => r.domain === hint || r.type === hint);
        }
        chains.push(this.unknownEntry);

        function wrapper(reg: ResourceRegistryEntry<any>) {
            return async () => {
                const meta = await reg.parseMetadata(fs);
                return {
                    ...reg,
                    metadata: meta,
                };
            };
        }

        const wrapped = chains.map(wrapper);

        let promise = wrapped.shift()!();
        while (wrapped.length !== 0) {
            const next = wrapped.shift();
            if (next) {
                promise = promise.catch(() => next());
            }
        }

        const { domain, metadata, type, getSuggestedName, parseIcon } = await promise;
        builder.domain = domain;
        builder.metadata = metadata;
        builder.type = type;

        const suggested = getSuggestedName(metadata);
        if (suggested) {
            builder.name = suggested;
        }

        builder.icon = await parseIcon(metadata, fs).catch(() => undefined);
    }

    protected async commitResourceToDisk(builder: ResourceBuilder, data: Buffer) {
        const normalizedName = filenamify(builder.name, { replacement: '-' });

        let filePath = this.getPath(builder.domain, normalizedName + builder.ext);
        let metadataPath = this.getPath(builder.domain, `${normalizedName}.json`);
        let iconPath = this.getPath(builder.domain, `${normalizedName}.png`);

        if (await fs.exists(filePath)) {
            const slice = builder.hash.slice(0, 6);
            filePath = this.getPath(builder.domain, `${normalizedName}-${slice}${builder.ext}`);
            metadataPath = this.getPath(builder.domain, `${normalizedName}-${slice}.json`);
            iconPath = this.getPath(builder.domain, `${normalizedName}-${slice}.png`);
        }

        filePath = resolve(filePath);
        metadataPath = resolve(metadataPath);
        iconPath = resolve(iconPath);

        await fs.ensureFile(filePath);
        await fs.writeFile(filePath, data);
        await fs.writeFile(metadataPath, JSON.stringify(toResource(builder), null, 4));
        if (builder.icon) {
            await fs.writeFile(iconPath, builder.icon);
        }
        builder.path = filePath;
    }

    private async discardResourceOnDisk(resource: Readonly<AnyResource>) {
        const baseName = basename(resource.path, resource.ext);
        const filePath = resource.path;
        const metadataPath = this.getPath(resource.domain, `${baseName}`);
        const iconPath = this.getPath(resource.domain, `${baseName}.png`);

        await fs.unlink(filePath).catch(() => { });
        await fs.unlink(metadataPath).catch(() => { });
        await fs.unlink(iconPath).catch(() => { });
    }

    async load() {
        if (await fs.exists(this.getPath('resources'))) {
            // legacy
            const resources = await fs.readdir(this.getPath('resources'));
            this.commit('resources', await Promise.all(resources
                .filter(file => !file.startsWith('.'))
                .map(file => this.getPath('resources', file))
                .map(file => fs.readFile(file).then(b => JSON.parse(b.toString())))));
        }
        const resources: AnyResource[] = [];
        await Promise.all(['mods', 'resourcepacks', 'saves', 'modpacks']
            .map(async (domain) => {
                const path = this.getPath(domain);
                await fs.ensureDir(path);
                const files = await fs.readdir(path);
                for (const file of files.filter(f => f.endsWith('.json'))) {
                    const filePath = join(path, file);
                    const read = await getPersistence({ path: filePath, schema: ResourceConfig });
                    if (read !== {}) {
                        resources.push(read);
                    }
                }
            }));
        this.commit('resources', resources);
    }

    /**
     * Force refresh a resource
     * @param res 
     */
    async refreshResource(res: string | AnyResource) {
        const resource = this.normalizeResource(res);
        if (!resource) return;
        try {
            const builder = toBuilder(resource);
            const data = await fs.readFile(resource.path);
            await this.resolveResource(builder, data, resource.type);
            await this.commitResourceToDisk(builder, data);
            this.commit('resource', toResource(builder));
        } catch (e) {
            console.error(e);
            await this.discardResourceOnDisk(resource);
            this.commit('removeResource', resource);
        }
    }

    /**
     * Touch a resource. If it's checksum not matched, it will re-import this resource.
     */
    async touchResource(res: string | AnyResource) {
        const resource = this.normalizeResource(res);
        if (!resource) return;

        try {
            const builder = toBuilder(resource);
            const data = await fs.readFile(resource.path);
            builder.hash = sha1(data);
            if (builder.hash !== resource.hash) {
                await this.discardResourceOnDisk(resource);
                await this.commitResourceToDisk(builder, data);
                this.commit('resource', toResource(builder));
            }
        } catch (e) {
            console.error(e);
            await this.discardResourceOnDisk(resource);
            this.commit('removeResource', resource);
        }
    }

    /**
     * Remove a resource from the launcher
     * @param resource 
     */
    async removeResource(resource: string | AnyResource) {
        const resourceObject = this.normalizeResource(resource);
        if (!resourceObject) return;
        this.commit('removeResource', resourceObject);
        const ext = extname(resourceObject.path);
        const pure = resourceObject.path.substring(0, resourceObject.path.length - ext.length);
        if (await fs.exists(resourceObject.path)) {
            await fs.unlink(resourceObject.path);
        }
        if (await fs.exists(`${pure}.json`)) {
            await fs.unlink(`${pure}.json`);
        }
        if (await fs.exists(`${pure}.png`)) {
            await fs.unlink(`${pure}.png`);
        }
    }

    /**
     * Rename resource, this majorly affect displayed name.
     */
    async renameResource(option: { resource: string | AnyResource; name: string }) {
        const resource = this.normalizeResource(option.resource);
        if (!resource) return;
        const builder = toBuilder(resource);
        builder.name = option.name;
        const result = toResource(builder);
        const ext = extname(resource.path);
        const pure = resource.path.substring(0, resource.path.length - ext.length);
        await fs.writeFile(`${pure}.json`, JSON.stringify(result));
        this.commit('resource', result);
    }

    /**
     * Deploy all the resource from `resourceUrls` into profile which uuid equals to `profile`.
     * 
     * The `mods` and `resourcepacks` will be deploied by linking the mods & resourcepacks files into the `mods` and `resourcepacks` directory of the profile.
     * 
     * The `saves` and `modpack` will be deploied by pasting the saves and modpack overrides into this profile directory.
     */
    async deployResources(payload: { resourceUrls: string[]; profile: string }) {
        if (!payload) throw new Error('Require input a resource with minecraft location');
        const { resourceUrls: resources, profile } = payload;
        if (!resources) throw new Error('Resources cannot be undefined!');
        if (!profile) throw new Error('Profile id cannot be undefined!');

        const promises = [];
        for (const resource of resources) {
            const res = this.normalizeResource(resource);
            if (!res) {
                promises.push(Promise.reject(new Error(`Cannot find the resource ${resource}`)));
                continue;
            }
            if (typeof res !== 'object' || !res.hash || !res.type || !res.domain || !res.name) {
                promises.push(Promise.reject(new Error(`The input resource object should be valid! ${JSON.stringify(resource, null, 4)}`)));
                continue;
            }
            if (res.domain === 'mods' || res.domain === 'resourcepacks') {
                const dest = this.getPath('profiles', profile, res.domain, res.name + res.ext);
                try {
                    const stat = await fs.lstat(dest);
                    if (stat.isSymbolicLink()) {
                        await fs.unlink(dest);
                        promises.push(fs.symlink(res.path, dest));
                    } else {
                        console.error(`Cannot deploy resource ${res.hash} -> ${dest}, since the path is occupied.`);
                    }
                } catch (e) {
                    promises.push(fs.symlink(res.path, dest));
                }
            } else if (res.domain === 'saves') { // TODO: consider how to implement this
                // await this.instanceSerivce.importSave(res.path);
            } else if (res.domain === 'modpacks') { // modpack will override the profile
                // await this.curseforgeSerivce.importCurseforgeModpack({
                //     profile,
                //     path: res.path,
                // });
            }
        }
        await Promise.all(promises);
    }

    /**
     * Import the resource into the launcher.
     * @returns The resource resolved. If the resource cannot be resolved, it will goes to unknown domain.
     */
    async importResource({ path, type, metadata = {}, background = false }: ImportOption) {
        requireString(path);
        const task = importResourceTask(path, type, metadata).bind(this);
        const res = await this.submit(task).wait();
        return res;
    }

    /**
     * Export the resources into target directory. This will simply copy the resource out.
     */
    async exportResource(payload: { resources: (string | AnyResource)[]; targetDirectory: string }) {
        const { resources, targetDirectory } = payload;

        const promises = [];
        for (const resource of resources) {
            let res: Resource<any> | undefined;
            if (typeof resource === 'string') res = this.getters.getResource(resource);
            else res = resource;

            if (!res) throw new Error(`Cannot find the resource ${resource}`);

            promises.push(fs.copy(res.path, join(targetDirectory, res.name + res.ext)));
        }
        await Promise.all(promises);
    }
}
