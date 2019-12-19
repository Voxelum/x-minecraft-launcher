import { Fabric, FileSystem, Forge, Net, System, Task, Util, WorldReader } from '@xmcl/minecraft-launcher-core';
import { createHash } from 'crypto';
import filenamify from 'filenamify';
import { cacheWithHash, fs, requireString } from 'main/utils';
import { getPersistence } from 'main/utils/persistence';
import { basename, extname, join, resolve } from 'path';
import { AnyResource, ImportOption, ImportTypeHint, Resource, UNKNOWN_RESOURCE } from 'universal/store/modules/resource';
import { ResourceSchema } from 'universal/store/modules/resource.schema';
import { CURSEMETA_CACHE } from 'main/constant';
import { parse as parseUrl, UrlWithStringQuery } from 'url';
import Service from './Service';

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

export interface ResourceRegistryEntry<T> {
    type: string;
    domain: string;
    ext: string;
    parseIcon: (metadata: T, data: FileSystem) => Promise<Uint8Array | undefined>;
    parseMetadata: (data: FileSystem) => Promise<T>;
    getSuggestedName: (metadata: T) => string;
    /**
     * Get ideal uri for this resource
     */
    getUri: (metadata: T, hash: string) => string;
}

export interface ResourceHost {
    /**
     * Query the resource by uri.
     * Throw error if not found.
     * @param uri The uri for the querying resource
     */
    query(uri: UrlWithStringQuery): Promise<{
        /**
         * The resource url
         */
        url: string;
        source: { key: string; value: any };
        type: string;
    } | undefined>;
}

export default class ResourceService extends Service {
    private resourceRegistry: ResourceRegistryEntry<any>[] = [];

    private resourceHosts: ResourceHost[] = [];

    /**
     * Query local resource by url
     */
    queryResouceLocal(url: string) {
        requireString(url);
        const state = this.state.resource;
        for (const d of Object.keys(state.domains)) {
            const res = state.domains[d];
            for (const v of Object.values(res)) {
                const uris = v.source.uri;
                if (uris.some(u => u === url)) {
                    return v;
                }
            }
        }
        return UNKNOWN_RESOURCE;
    }

    /**
     * resolve a uri to actual fetchable url, like https:// or file://
     * @param uri The input uri
     */
    protected async resolveURI(uri: UrlWithStringQuery) {
        if (uri.protocol === 'https:' || uri.protocol === 'file:' || uri.protocol === 'http:') {
            return { url: uri.href, source: undefined, type: undefined };
        }
        for (const host of this.resourceHosts) {
            const result = await host.query(uri);
            if (result) return result;
        }
        return { url: undefined, source: undefined, type: undefined };
    }

    /**
     * Import regular resource from uri.
     * @param uri The spec uri format
     */
    protected importResourceTask(uri: string, extra: any) {
        const importResource = async (context: Task.Context) => {
            const parsed = parseUrl(uri);

            const localResource = this.getters.queryResource(uri);
            if (localResource) {
                return localResource;
            }
            const { url: realUrl, source: expectedSource, type } = await this.resolveURI(parsed);
            if (!realUrl) {
                console.warn(`Cannot find the remote source of the resource ${uri}`);
                return UNKNOWN_RESOURCE;
            }

            context.update(0, 4, uri);
            const { buffer, urls: redirectUrls, hash } = await context.execute(cacheWithHash(realUrl));
            const base = redirectUrls ? redirectUrls[redirectUrls.length - 1] : realUrl;
            const ext = extname(base);
            const builder: Resource<any> = {
                name: basename(base, ext),
                path: '',
                hash,
                ext,
                domain: '',
                type: type || '',
                metadata: {},
                source: {
                    uri: [uri, realUrl, ...(redirectUrls || [])],
                    date: Date.now(),
                },
            };
            if (expectedSource) {
                builder.source[expectedSource.key] = Object.assign({}, expectedSource.value, extra);
            }

            // use parser to parse metadata
            context.update(1, 4, uri);

            const parsing = () => this.resolveResource(builder, buffer, type);
            await context.execute(parsing);
            console.log(`Imported resource ${builder.name}${builder.ext}(${builder.hash}) into ${builder.domain}`);

            // write resource to disk
            context.update(3, 4, uri);
            const storing = () => this.commitResourceToDisk(builder, buffer);
            await context.execute(storing);

            // done
            context.update(4, 4, uri);

            const reuslt = toResource(builder);
            this.commit('resource', reuslt);
            return reuslt;
        };
        return importResource;
    }

    /**
     * Import unknown resource task. Only used for importing unknown resource from file.
     * @param path The file path
     * @param type The guessing resource hint
     */
    importUnknownResourceTask(path: string, type: ImportTypeHint | undefined, metadata: any) {
        const importResource = async (context: Task.Context) => {
            context.update(0, 4, path);
            const isDirectory = await fs.stat(path).then(stat => stat.isDirectory());
            if (isDirectory) throw new Error(`Cannot import directory as resource! ${path}`);
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
                    uri: [`file://${resolve(path)}`],
                    date: Date.now(),
                    ...metadata,
                },
            };
            builder.name = basename(path, builder.ext);

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
                const parsing = () => this.resolveResource(builder, data, type);
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
        };
        return importResource;
    }

    private unknownEntry: ResourceRegistryEntry<unknown> = {
        type: 'unknown',
        domain: 'unknowns',
        ext: '*',
        parseIcon: () => Promise.resolve(undefined),
        parseMetadata: () => Promise.resolve({}),
        getSuggestedName: () => '',
        getUri: () => '',
    };

    constructor() {
        super();
        this.registerResourceType({
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
            getUri: meta => `forge://${meta[0].modid}/${meta[0].version}`,
        });
        this.registerResourceType({
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
            getUri: meta => `liteloader://${meta.name}/${meta.version}`,
        });
        this.registerResourceType({
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
            getUri: meta => `fabric://${meta.id}/${meta.version}`,
        });
        this.registerResourceType({
            type: 'resourcepack',
            domain: 'resourcepacks',
            ext: '.zip',
            parseIcon: async (meta, fs) => fs.readFile('icon.png'),
            parseMetadata: fs => fs.readFile('pack.mcmeta', 'utf-8').then(JSON.parse),
            getSuggestedName: () => '',
            getUri: (_, hash) => `resourcepack://${hash}`,
        });
        this.registerResourceType({
            type: 'save',
            domain: 'saves',
            ext: '.zip',
            parseIcon: async (meta, fs) => fs.readFile('icon.png'),
            parseMetadata: fs => new WorldReader(fs).getLevelData(),
            getSuggestedName: meta => meta.LevelName,
            getUri: (_, hash) => `save://${hash}`,
        });
        this.registerResourceType({
            type: 'curseforge-modpack',
            domain: 'modpacks',
            ext: '.zip',
            parseIcon: () => Promise.resolve(undefined),
            parseMetadata: fs => fs.readFile('mainifest.json', 'utf-8').then(JSON.parse),
            getSuggestedName: () => '',
            getUri: (_, hash) => `modpack://${hash}`,
        });

        this.resourceHosts.push({
            async query(uri) {
                if (uri.protocol !== 'curseforge:') {
                    return undefined;
                }
                if (uri.host === 'path') {
                    const [projectType, projectPath, fileId] = uri.path!.split('/').slice(1);
                    return {
                        url: `https://www.curseforge.com/minecraft/${projectType}/${projectPath}/download/${fileId}/file`,
                        type: '*',
                        source: {
                            key: 'curseforge',
                            value: {
                                projectType,
                                projectPath,
                            },
                        },
                    };
                }
                const [projectId, fileId] = uri.path!.split('/').slice(1);
                const metadataUrl = `${CURSEMETA_CACHE}/${projectId}/${fileId}.json`;
                const o = await Net.fetchJson(metadataUrl);
                const url = o.body.DownloadURL;
                return {
                    url,
                    type: '*',
                    source: {
                        key: 'curseforge',
                        value: {
                            projectId,
                            fileId,
                        },
                    },
                };
            },
        });
    }

    private normalizeResource(resource: string | AnyResource) {
        return typeof resource === 'string' ? this.getters.getResource(resource) : resource;
    }

    protected registerResourceType(entry: ResourceRegistryEntry<any>) {
        if (this.resourceRegistry.find(r => r.type === entry.type)) {
            throw new Error(`The entry type ${entry.type} existed!`);
        }
        this.resourceRegistry.push(entry);
    }

    /**
     * Resolve the resource metadata by its content
     * @param builder The resource builder
     * @param data The resource self
     * @param typeHint The type hint
     */
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

        const { domain, metadata, type, getSuggestedName, parseIcon, getUri } = await promise;
        builder.domain = domain;
        builder.metadata = metadata;
        builder.type = type;

        const suggested = getSuggestedName(metadata);
        if (suggested) {
            builder.name = suggested;
        }

        builder.icon = await parseIcon(metadata, fs).catch(() => undefined);
        try {
            builder.source.uri.push(getUri(metadata, builder.hash));
        } catch {
            console.warn(`Fail to inspect the uri for ${builder.name}[${builder.hash}]`);
        }
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
                    const read: ResourceSchema<any> = await getPersistence({ path: filePath, schema: ResourceSchema });
                    resources.push(read);
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
            this.commit('resourceRemove', resource);
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
            this.commit('resourceRemove', resource);
        }
    }

    /**
     * Remove a resource from the launcher
     * @param resource 
     */
    async removeResource(resource: string | AnyResource) {
        const resourceObject = this.normalizeResource(resource);
        if (!resourceObject) return;
        this.commit('resourceRemove', resourceObject);
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
     * Import the resource into the launcher.
     * @returns The resource resolved. If the resource cannot be resolved, it will goes to unknown domain.
     */
    async importUnknownResource({ path, type, metadata = {} }: ImportOption) {
        requireString(path);
        const task = this.importUnknownResourceTask(path, type, metadata);
        const res = await this.submit(task).wait();
        return res;
    }

    /**
     * Import resource from uri
     */
    async importResource(option: {
        /**
         * The expected uri
         */
        uri: string;
        metadata: object;
    }) {
        const { uri, metadata = {} } = option;
        requireString(uri);
        return this.submit(this.importResourceTask(uri, metadata)).wait();
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
