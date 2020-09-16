import { createResourceBuilder, getBuilderFromResource, getResourceFromBuilder, importResource, mutateResource, readResourceHeader, removeResource, ResourceCache, SourceInformation } from '@main/entities/resource';
import { fixResourceSchema } from '@main/util/dataFix';
import { copyPassively, readdirEnsured, sha1, sha1ByPath } from '@main/util/fs';
import { Resource, Resources, UNKNOWN_RESOURCE } from '@universal/entities/resource';
import { CurseforgeInformation, ResourceSchema, ResourceType } from '@universal/entities/resource.schema';
import { requireString } from '@universal/util/assert';
import { Task, task } from '@xmcl/task';
import { FileType } from 'file-type';
import { readFile, stat } from 'fs-extra';
import { extname, isAbsolute, join } from 'path';
import Service from './Service';

export type ImportTypeHint = string | '*' | 'mods' | 'forge' | 'fabric' | 'resourcepack' | 'liteloader' | 'curseforge-modpack' | 'save';
export type ImportOption = {
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
    getResourceByKey(key: string | number): Resource | undefined {
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

                const resourceFilePath = this.getPath(resourceData.location + resourceData.ext);
                const { size, ino } = await stat(resourceFilePath);
                const resource: Resource = Object.freeze({
                    ...resourceData,
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
     * Touch a resource. If it's checksum not matched, it will re-import this resource.
     */
    async touchResource(resourceKey: string) {
        let resource = this.normalizeResource(resourceKey);
        if (resource === UNKNOWN_RESOURCE) {
            return;
        }
        try {
            let builder = getBuilderFromResource(resource);
            builder.hash = await sha1ByPath(resource.path);
            if (builder.hash !== resource.hash) {
                const newResource = this.getResource(builder);
                this.cache.discard(resource);
                this.cache.put(newResource);
                this.commit('resource', newResource);
            }
        } catch (e) {
            this.cache.discard(resource);
            await this.unpersistResource(resource);
            this.commit('resourceRemove', resource);
            this.error(e);
        }
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
    async importResources(files: {
        filePath: string;
        url: string[];
        source?: {
            curseforge?: CurseforgeInformation;
        };
    }[], typeHint?: string) {
        let resources = await Promise.all(files.map((f) => this.resolveResourceTask({ path: f.filePath, url: f.url, source: f.source, type: typeHint }).execute().wait()));
        this.log(`Import ${files.length} resources. Imported ${resources.filter(r => r.imported).length} new resources, and ${resources.filter(r => !r.imported).length} resources existed.`);
        for (let resource of resources) {
            this.cache.put(resource.resource);
        }
        this.commit('resources', resources.map(r => r.resource));
    }

    /**
     * Import the resource into the launcher.
     * @returns The resource resolved. If the resource cannot be resolved, it will goes to unknown domain.
     */
    async importResource(option: ImportOption) {
        requireString(option.path);
        let task = this.resolveResourceTask(option);
        let { resource, imported } = await (option.background ? task.execute().wait() : this.submit(task).wait());
        if (imported) {
            this.log(`Import and cache newly added resource ${resource.path}`);
            this.cache.put(resource);
            this.commit('resource', resource);
        } else if (!option.background) {
            this.log(`Import existed resource ${resource.path}`);
        }
        return resource;
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

    // bridge from dry function to `this` context

    /**
     * Resolve resource task. This will not write the resource to the cache, but it will persist the resource to disk.  
     */
    resolveResourceTask(importOption: ImportOption) {
        const resolve = async (context: Task.Context) => {
            const { path, source = {}, url = [], type } = importOption;
            context.update(0, 4, path);

            const fileStat = await stat(path);
            context.update(0, 1, path);

            if (fileStat.isDirectory()) {
                throw new Error(`Cannot import dictionary resource ${importOption.path}`);
            }

            let hash: string | undefined;
            let resource: Resource | undefined;

            resource = this.getResourceByKey(fileStat.ino);
            if (!resource) {
                hash = await sha1ByPath(path);
                resource = this.getResourceByKey(hash);
            }
            context.update(2, 4, path);
            // resource existed
            if (resource) {
                return { imported: false, resource };
            }

            const resolved = await readResourceHeader(path, type);
            context.update(3, 4, path);
            const result = await importResource(path, source ?? {}, resolved, this.getPath());
            context.update(4, 4, path);
            return { imported: true, resource: result };
        };

        return task('importResource', resolve);
    }

    protected unpersistResource(resource: Resource) {
        return removeResource(resource, this.getPath());
    }
}
