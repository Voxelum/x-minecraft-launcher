import { CURSEMETA_CACHE } from '@main/constant';
import { checksum, copyPassively, exists, isDirectory, readdirEnsured } from '@main/util/fs';
import { commitResourceOnDisk, createResourceBuilder, decorateBuilderFromHost, decorateBuilderFromMetadata, decorateBuilderWithPathAndHash, decorateBulderWithUrlsAndHash, discardResourceOnDisk, getResourceFromBuilder, parseResource, ResourceHost, ResourceRegistryEntry, RESOURCE_ENTRY_FABRIC, RESOURCE_ENTRY_FORGE, RESOURCE_ENTRY_LITELOADER, RESOURCE_ENTRY_MODPACK, RESOURCE_ENTRY_RESOURCE_PACK, RESOURCE_ENTRY_SAVE, ResourceBuilder, getBuilderFromResource, DomainedSourceCollection } from '@main/util/resource';
import { ImportOption, ImportTypeHint, Resource, UNKNOWN_RESOURCE } from '@universal/store/modules/resource';
import { ResourceSchema } from '@universal/store/modules/resource.schema';
import { requireString } from '@universal/util/assert';
import { Task, task } from '@xmcl/task';
import { createHash } from 'crypto';
import { readFile, writeFile } from 'fs-extra';
import { extname, join } from 'path';
import Service from './Service';

function sha1(data: Buffer) {
    return createHash('sha1').update(data).digest('hex');
}

export default class ResourceService extends Service {
    private resourceRegistry: ResourceRegistryEntry<any>[] = [];

    private resourceHosts: ResourceHost[] = [];

    constructor() {
        super();
        this.registerResourceType(RESOURCE_ENTRY_FORGE);
        this.registerResourceType(RESOURCE_ENTRY_LITELOADER);
        this.registerResourceType(RESOURCE_ENTRY_FABRIC);
        this.registerResourceType(RESOURCE_ENTRY_SAVE);
        this.registerResourceType(RESOURCE_ENTRY_RESOURCE_PACK);
        this.registerResourceType(RESOURCE_ENTRY_MODPACK);

        let networkManager = this.networkManager;
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
                            curseforge: {
                                projectType,
                                projectPath,
                            },
                        },
                    };
                }
                const [projectId, fileId] = uri.path!.split('/').slice(1);
                const metadataUrl = `${CURSEMETA_CACHE}/${projectId}/${fileId}.json`;
                const o: any = await networkManager.request(metadataUrl).json();
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

    protected normalizeResource(resource: string | Resource) {
        return typeof resource === 'string' ? this.getters.getResource(resource) : resource;
    }

    protected registerResourceType(entry: ResourceRegistryEntry<any>) {
        if (this.resourceRegistry.find(r => r.type === entry.type)) {
            throw new Error(`The entry type ${entry.type} existed!`);
        }
        this.resourceRegistry.push(entry);
    }

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


    async load() {
        if (await exists(this.getPath('resources'))) {
            // legacy
            const resources = await readdirEnsured(this.getPath('resources'));
            this.commit('resources', await Promise.all(resources
                .filter(file => !file.startsWith('.'))
                .map(file => this.getPath('resources', file))
                .map(file => this.getPersistence({ path: file, schema: ResourceSchema }))));
        }
        const resources: Resource[] = [];
        await Promise.all(['mods', 'resourcepacks', 'saves', 'modpacks']
            .map(async (domain) => {
                const path = this.getPath(domain);
                const files = await readdirEnsured(path);
                for (const file of files.filter(f => f.endsWith('.json'))) {
                    const filePath = join(path, file);
                    const read: ResourceSchema = await this.getPersistence({ path: filePath, schema: ResourceSchema });
                    resources.push(read);
                }
            }));
        this.commit('resources', resources);
    }

    /**
     * Force refresh a resource
     * @param res 
     */
    async refreshResource(res: string | Resource) {
        let resource = this.normalizeResource(res);
        if (resource === UNKNOWN_RESOURCE) return;
        try {
            let builder = getBuilderFromResource(resource);

            let data = await readFile(resource.path);

            await this.updateBuilderMetadata(builder, data);

            await this.persistResource(builder, data);

            this.commit('resource', getResourceFromBuilder(builder));
        } catch (e) {
            this.error(e);
            await this.unpersistResource(resource);
            this.commit('resourceRemove', resource);
        }
    }

    /**
     * Touch a resource. If it's checksum not matched, it will re-import this resource.
     */
    async touchResource(res: string | Resource) {
        let resource = this.normalizeResource(res);

        if (resource === UNKNOWN_RESOURCE) return;
        try {
            let builder = getBuilderFromResource(resource);
            let data = await readFile(resource.path);
            builder.hash = sha1(data);

            if (builder.hash !== resource.hash) {
                await this.unpersistResource(resource);
                await this.persistResource(builder, data);

                this.commit('resource', getResourceFromBuilder(builder));
            }
        } catch (e) {
            await this.unpersistResource(resource);
            this.commit('resourceRemove', resource);

            this.error(e);
        }
    }

    /**
     * Remove a resource from the launcher
     * @param resource 
     */
    async removeResource(resource: string | Resource) {
        let resourceObject = this.normalizeResource(resource);
        if (resourceObject === UNKNOWN_RESOURCE) return;

        this.commit('resourceRemove', resourceObject);
        this.unpersistResource(resourceObject);
    }

    /**
     * Rename resource, this majorly affect displayed name.
     */
    async renameResource(option: { resource: string | Resource; name: string }) {
        const resource = this.normalizeResource(option.resource);
        if (!resource) return;
        const builder = getBuilderFromResource(resource);
        builder.name = option.name;
        const result = getResourceFromBuilder(builder);
        const ext = extname(resource.path);
        const pure = resource.path.substring(0, resource.path.length - ext.length);
        await writeFile(`${pure}.json`, JSON.stringify(result));
        this.commit('resource', result);
    }

    /**
     * Import the resource into the launcher.
     * @returns The resource resolved. If the resource cannot be resolved, it will goes to unknown domain.
     */
    importUnknownResource({ path, type, metadata = {} }: ImportOption) {
        requireString(path);
        let task = this.importUnknownResourceTask(path, type, metadata);
        return this.submit(task).wait();
    }

    /**
     * Import resource from uri
     */
    async importResource(option: {
        /**
         * The expected uri
         */
        uri: string;
        typeHint?: string;
        metadata?: DomainedSourceCollection;
    }) {
        const { uri, metadata = {}, typeHint } = option;
        requireString(uri);
        return this.submit(this.importResourceTask(uri, metadata, typeHint)).wait();
    }

    /**
     * Export the resources into target directory. This will simply copy the resource out.
     */
    async exportResource(payload: { resources: (string | Resource)[]; targetDirectory: string }) {
        const { resources, targetDirectory } = payload;

        const promises = [];
        for (const resource of resources) {
            let res: Resource<any> | undefined;
            if (typeof resource === 'string') res = this.getters.getResource(resource);
            else res = resource;

            if (!res) throw new Error(`Cannot find the resource ${resource}`);

            promises.push(copyPassively(res.path, join(targetDirectory, res.name + res.ext)));
        }
        await Promise.all(promises);
    }

    // bridge from dry function to `this` context


    /**
     * Import regular resource from uri.
     * 
     * - forge mod: forge://<modid>/<version>
     * - liteloader mod: liteloader://<name>/<version>
     * - curseforge file: curseforge://<projectId>/<fileId>
     * 
     * @param uri The spec uri format
     */
    importResourceTask(uri: string, sourceInfo: DomainedSourceCollection = {}, typeHint?: string) {
        const importResource = task('importResource', async (context: Task.Context) => {
            let localResource = this.getters.queryResource(uri);
            if (localResource !== UNKNOWN_RESOURCE) {
                this.log(`Found existed resource for ${uri}. Return.`);
                return localResource;
            }

            let builder = createResourceBuilder(sourceInfo);

            let resolved = await decorateBuilderFromHost(builder, this.resourceHosts, uri, typeHint);

            if (!resolved) {
                this.warn(`Cannot find the remote source of the resource ${uri}. Return unknown resource.`);
                return UNKNOWN_RESOURCE;
            }

            let resolvedUrl = builder.source.uri[builder.source.uri.length - 1];

            context.update(0, 4, uri);

            let { data, urls, hash } = await context.execute(task('download', async (c) => {
                let buffers: Buffer[] = [];
                let hasher = createHash('sha1');
                let urls: string[] = [];
                let stream = this.networkManager.request.stream(resolvedUrl, {
                    followRedirect: true,
                });

                c.pausealbe(stream.pause, stream.resume);

                stream.on('data', (b) => {
                    buffers.push(b);
                    hasher.update(b);
                });
                stream.on('downloadProgress', (p) => {
                    c.update(p.transferred, p.total || undefined);
                });
                stream.on('redirect', (m) => {
                    if (m.url) { urls.push(m.url); }
                });
                await new Promise((resolve, reject) => {
                    stream.on('end', resolve);
                    stream.on('error', reject);
                });

                return {
                    data: Buffer.concat(buffers),
                    hash: hasher.digest('hex'),
                    urls,
                };
            }), 1);

            decorateBulderWithUrlsAndHash(builder, urls, hash);

            // use parser to parse metadata
            await context.execute(task('parsing',
                () => this.updateBuilderMetadata(builder, data, typeHint)), 1);

            this.log(`Imported resource ${builder.name}${builder.ext}(${builder.hash}) into ${builder.domain} (type hint: ${typeHint})`);

            // write resource to disk
            await context.execute(task('storing',
                () => this.persistResource(builder, data)), 1);

            let reuslt = getResourceFromBuilder(builder);
            this.commit('resource', reuslt);
            return reuslt;
        });
        return importResource;
    }

    /**
     * Import unknown resource task. Only used for importing unknown resource from file.
     * @param path The file path
     * @param type The guessing resource hint
     */
    protected importUnknownResourceTask(path: string, type: ImportTypeHint | undefined, metadata: any) {
        const importResource = async (context: Task.Context) => {
            context.update(0, 4, path);

            if (await isDirectory(path)) throw new Error(`Cannot import directory as resource! ${path}`);

            let data = await readFile(path);
            let builder = createResourceBuilder(metadata);

            decorateBuilderWithPathAndHash(builder, path, await checksum(path, 'sha1'));

            // check the resource existence
            let existed = await context.execute(task('checking', async () => {
                let resource = this.getters.getResource(builder.hash);
                if (resource !== UNKNOWN_RESOURCE) {
                    Object.assign(builder, resource, { source: builder.source });
                    return true;
                }
                return false;
            }), 1);
            if (!existed) {
                // use parser to parse metadata
                await context.execute(task('parsing',
                    () => this.updateBuilderMetadata(builder, data, type)), 1);

                this.log(`Imported resource ${builder.name}${builder.ext}(${builder.hash}) into ${builder.domain}`);

                // write resource to disk
                await context.execute(task('storing',
                    () => this.persistResource(builder, data)), 1);
            }

            let resource = getResourceFromBuilder(builder);
            this.commit('resource', resource);
            return resource;
        };
        return task('importResource', importResource);
    }

    protected persistResource(builder: ResourceBuilder, resourceData: Buffer) {
        return commitResourceOnDisk(builder, resourceData, this.getPath());
    }

    protected unpersistResource(builder: ResourceBuilder) {
        return discardResourceOnDisk(builder, this.getPath());
    }

    protected async updateBuilderMetadata(builder: ResourceBuilder, resourceData: Buffer, type?: string) {
        type = type ?? builder.type;
        let resourceInfo = await parseResource(this.resourceRegistry, resourceData, builder.ext, type);
        decorateBuilderFromMetadata(builder, resourceInfo);
    }
}
