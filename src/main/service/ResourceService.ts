import { importResource, mutateResource, readResourceHeader, removeResource, ResourceCache, SourceInformation } from '@main/entities/resource';
import { fixResourceSchema } from '@main/util/dataFix';
import { copyPassively, readdirEnsured, sha1ByPath } from '@main/util/fs';
import { Resource, Resources, UNKNOWN_RESOURCE } from '@universal/entities/resource';
import { ResourceSchema } from '@universal/entities/resource.schema';
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
}
export interface ImportMultipleFilesOptions {
    files: Array<{
        filePath: string;
        url: string[];
        source?: SourceInformation
    }>;
    background?: boolean;
    /**
     * The hint for the import file type
     */
    type?: ImportTypeHint;
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
                const filePath = join(path, file);
                const resourceData = await this.getPersistence({ path: filePath, schema: ResourceSchema });

                fixResourceSchema(resourceData, this.getPath());

                console.log(resourceData);

                const resourceFilePath = this.getPath(resourceData.location);
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
            })).then((resources) => {
                this.commit('resources', resources);
            });
            this.loadPromises[domain] = promise;
        });
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
    * 
    * The original file will not be modified.
    * 
    * @param path The path in the same disk
    * @param urls The urls
    * @param source The source metadata
    */
    async importResources(options: ImportMultipleFilesOptions) {
        const total = await Promise.all(options.files.map((f) => this.queryExistedResourceByPath(f.filePath)));
        const existedCount = total.filter((r) => !!r).length;
        const resources = await Promise.all(options.files
            .filter((_, i) => !total[i])
            .map((f) => this.resolveResourceTask({ path: f.filePath, url: f.url, source: f.source, type: options.type, background: options.background })
                .execute().wait()));

        this.log(`Import ${total.length} resources. Imported ${resources.length} new resources, and ${existedCount} resources existed.`);
        for (const resource of resources) {
            this.cache.put(resource);
        }
        this.commit('resources', resources);
    }

    addResource(resources: Resources[]) {
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
            result = this.getResourceByKey(await sha1ByPath(path));
        }

        return result;
    }

    // bridge from dry function to `this` context

    /**
     * Resolve resource task. This will not write the resource to the cache, but it will persist the resource to disk.  
     */
    resolveResourceTask(importOption: ImportOptions) {
        const resolve = async (context: Task.Context) => {
            const { path, source = {}, url = [], type } = importOption;
            context.update(0, 4, path);
            const resolved = await readResourceHeader(path, type);
            context.update(3, 4, path);
            const result = await importResource(path, source ?? {}, resolved, this.getPath());
            context.update(4, 4, path);
            return result as Resources;
        };

        return task('importResource', resolve);
    }

    protected unpersistResource(resource: Resource) {
        return removeResource(resource, this.getPath());
    }
}
