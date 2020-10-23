import { resolveAndPersist, mutateResource, readHeader, remove, ResourceCache, SourceInformation } from '@main/entities/resource';
import { fixResourceSchema } from '@main/util/dataFix';
import { copyPassively, readdirEnsured, sha1ByPath } from '@main/util/fs';
import { Resource, Resources, UNKNOWN_RESOURCE } from '@universal/entities/resource';
import { ResourceSchema, ResourceType, ResourceDomain } from '@universal/entities/resource.schema';
import { requireString } from '@universal/util/assert';
import { Task, task } from '@xmcl/task';
import { stat } from 'fs-extra';
import { extname, join } from 'path';
import Service from './Service';

export type ImportTypeHint = string | '*' | 'mods' | 'forge' | 'fabric' | 'resourcepack' | 'liteloader' | 'curseforge-modpack' | 'save';
export type ImportOptions = {
    /**
     * The real file path of the resource
     */
    path: string;
    /**
     * The hint for the import file type
     */
    type?: ImportTypeHint;
    /**
     * The extra info you want to provide to the source of the resource
     */
    source?: SourceInformation;

    url?: string[];

    background?: boolean;
    /**
     * Require the resource to be these specific domain
     */
    requiredDomain?: ResourceDomain;
}
export interface ImportMultipleFilesOptions {
    files: Array<{
        path: string;
        url: string[];
        source?: SourceInformation
    }>;
    background?: boolean;
    /**
     * The hint for the import file type
     */
    type?: ImportTypeHint;
    /**
     * Require the resource to be these specific domain
     */
    fromDomain?: ResourceDomain;
}
export interface ParseFilesOptions {
    files: { path: string; hint?: ImportTypeHint; size?: number }[];
}
export interface Query {
    hash?: string;
    url?: string | string[];
    ino?: number;
}

export interface AddResourceOptions {
    path: string;
    hash?: string;
    type?: ImportTypeHint;
    source?: SourceInformation;
}

class DomainMissMatchedError extends Error {
    constructor(domain: string, path: string, type: string) {
        super(`Non-${domain} resource at ${path} type=${type}`);
    }
}

export default class ResourceService extends Service {
    private cache = new ResourceCache();

    private loadPromises: Record<string, Promise<void>> = {};

    protected normalizeResource(resource: string | Resources): Resources {
        return (typeof resource === 'string' ? this.cache.get(resource) : resource) ?? UNKNOWN_RESOURCE;
    }

    /**
     * Query in memory resource by key.
     * The key can be `hash`, `url` or `ino` of the file.
     */
    getResourceByKey(key: string | number): Resources | undefined {
        return this.cache.get(key);
    }

    isResourceInCache(key: string | number) {
        return !!this.cache.get(key);
    }

    /**
     * Query resource in memory by the resource query 
     * @param query The resource query.
     */
    getResource(query: Query) {
        let res: Resource;
        if (query.hash) {
            res = this.cache.get(query.hash);
            if (res) return res;
        }
        if (query.url) {
            if (typeof query.url === 'string') {
                res = this.cache.get(query.url);
                if (res) return res;
            } else {
                for (let u of query.url) {
                    res = this.cache.get(u);
                    if (res) return res;
                }
            }
        }
        if (query.ino) {
            res = this.cache.get(query.ino);
            if (res) return res;
        }
        return UNKNOWN_RESOURCE;
    }

    async load() {
        ['mods', 'resourcepacks', 'saves', 'modpacks'].map(async (domain) => {
            const path = this.getPath(domain);
            const files = await readdirEnsured(path);
            const promise = Promise.all(files.filter(f => f.endsWith('.json')).map(async (file) => {
                try {
                    const filePath = join(path, file);
                    const resourceData = await this.getPersistence({ path: filePath, schema: ResourceSchema });

                    fixResourceSchema(resourceData, this.getPath());

                    const resourceFilePath = this.getPath(resourceData.location) + resourceData.ext;
                    const { size, ino } = await stat(resourceFilePath);
                    const resource: Resource = Object.freeze({
                        location: resourceData.location,
                        name: resourceData.name,
                        domain: resourceData.domain,
                        type: resourceData.type,
                        metadata: resourceData.metadata,
                        uri: resourceData.uri,
                        date: resourceData.date,
                        tags: resourceData.tags,
                        hash: resourceData.hash,
                        path: resourceFilePath,
                        size,
                        ino,
                        ext: extname(resourceFilePath),
                    });
                    return resource as Resources;
                } catch (e) {
                    this.error(`Cannot load resource ${file}`);
                    this.error(e);
                    return UNKNOWN_RESOURCE;
                }
            })).then((resources) => {
                this.commit('resources', resources.filter((r) => r !== UNKNOWN_RESOURCE));
                for (const res of resources) {
                    this.cache.put(res);
                }
            });
            this.loadPromises[domain] = promise;
        });
    }

    whenModsReady() {
        return this.loadPromises.mods;
    }

    whenResourcePacksReady() {
        return this.loadPromises.resourcepacks;
    }

    /**
     * Remove a resource from the launcher
     * @param resourceOrKey 
     */
    async removeResource(resourceOrKey: string | Resources) {
        let resource = this.normalizeResource(resourceOrKey);
        if (resource === UNKNOWN_RESOURCE) return;

        this.cache.discard(resource);
        this.commit('resourceRemove', resource);
        await this.unpersistResource(resource);
    }

    /**
     * Rename resource, this majorly affect displayed name.
     */
    async renameResource(option: { resource: string | Resources; name: string }) {
        const resource = this.normalizeResource(option.resource);
        if (resource === UNKNOWN_RESOURCE) return;
        const result = mutateResource<any>(resource, (r) => { r.name = option.name; });
        this.cache.discard(resource);
        this.cache.put(result);
        this.commit('resource', result);
    }

    /**
    * Import the resource from the same disk. This will parse the file and import it into our db by hardlink.
    * If the file already existed, it will not re-import it again
    * 
    * The original file will not be modified.
    * 
    * @param path The path in the same disk
    * @param urls The urls
    * @param source The source metadata
    * 
    * @returns All import file in resource form. If the file cannot be parsed, it will be UNKNOWN_RESOURCE.
    */
    async importResources(options: ImportMultipleFilesOptions) {
        const existedResources = await Promise.all(options.files.map((f) => this.queryExistedResourceByPath(f.path)));
        const allResources = await Promise.all(options.files
            .map(async (f, i) => {
                const existed = existedResources[i];
                if (existed) {
                    return existed;
                }
                try {
                    const result = await this.resolveResourceTask({ path: f.path, url: f.url, source: f.source, type: options.type, background: options.background, requiredDomain: options.fromDomain })
                        .execute().wait();
                    return result;
                } catch (e) {
                    if (e instanceof DomainMissMatchedError) {
                        this.warn(e.message);
                    } else {
                        this.error(e);
                    }
                    return UNKNOWN_RESOURCE;
                }
            }));

        const existedCount = existedResources.filter((r) => !!r).length;
        const unknownCount = allResources.filter(r => r.type === ResourceType.Unknown).length;
        const newCount = allResources.length - existedCount - unknownCount;

        if (options.fromDomain) {
            this.log(`Resolve ${existedResources.length} resources from /${options.fromDomain}. Imported ${newCount} new resources, ${existedCount} resources existed, and ${unknownCount} unknown resource.`);
        } else {
            this.log(`Resolve ${existedResources.length} resources. Imported ${newCount} new resources, ${existedCount} resources existed, and ${unknownCount} unknown resource.`);
        }
        this.addResources(allResources.filter(r => r.type !== ResourceType.Unknown));

        return allResources;
    }

    private addResources(resources: Resources[]) {
        for (const resource of resources) {
            this.cache.put(resource);
        }
        this.commit('resources', resources);
    }

    /**
     * Import the resource into the launcher.
     * @returns The resource resolved. If the resource cannot be resolved, it will goes to unknown domain.
     */
    async importResource(option: ImportOptions) {
        requireString(option.path);
        const existed = await this.queryExistedResourceByPath(option.path);
        if (!existed) {
            const task = this.resolveResourceTask(option);
            const resource = await (option.background ? task.execute().wait() : this.submit(task).wait());
            this.log(`Import and cache newly added resource ${resource.path}`);
            this.cache.put(resource);
            this.commit('resource', resource);
            return resource;
        }
        this.log(`Skip to import ${existed.path} as resource existed`);
        return existed;
    }

    /**
     * Export the resources into target directory. This will simply copy the resource out.
     */
    async exportResource(payload: { resources: (string | Resources)[]; targetDirectory: string }) {
        const { resources, targetDirectory } = payload;

        const promises = [] as Array<Promise<any>>;
        for (const resource of resources) {
            let res: Resource<any> = this.normalizeResource(resource);
            if (res === UNKNOWN_RESOURCE) throw new Error(`Cannot find the resource ${resource}`);

            promises.push(copyPassively(res.path, join(targetDirectory, res.name + res.ext)));
        }
        await Promise.all(promises);
    }

    async queryExistedResourceByPath(path: string) {
        let result: Resources | undefined;

        const fileStat = await stat(path);

        result = this.getResourceByKey(fileStat.ino);

        if (!result) {
            const sha1 = await sha1ByPath(path);
            result = this.getResourceByKey(sha1);
        }

        return result;
    }

    // bridge from dry function to `this` context

    /**
     * Resolve resource task. This will not write the resource to the cache, but it will persist the resource to disk.
     * @throws DomainMissMatchedError
     */
    resolveResourceTask(importOption: ImportOptions) {
        const resolve = async (context: Task.Context) => {
            const { path, source = {}, url = [], type, requiredDomain } = importOption;
            context.update(0, 4, path);
            const hash = await sha1ByPath(path);
            const resolved = await readHeader(path, hash, type);
            if (requiredDomain) {
                if (resolved.domain !== requiredDomain) {
                    throw new DomainMissMatchedError(resolved.domain, path, resolved.type);
                }
            }
            context.update(3, 4, path);
            const result = await resolveAndPersist(path, source ?? {}, url, resolved, this.getPath());
            context.update(4, 4, path);
            return result as Resources;
        };

        return task('importResource', resolve);
    }

    protected unpersistResource(resource: Resource) {
        return remove(resource, this.getPath());
    }
}
