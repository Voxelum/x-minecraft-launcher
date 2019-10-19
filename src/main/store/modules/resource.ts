import { Forge, LiteLoader, ResourcePack, Task } from '@xmcl/minecraft-launcher-core';
import Unzip from '@xmcl/unzip';
import { createHash, Hash } from 'crypto';
import fileType from 'file-type';
import { fs, requireString } from 'main/utils';
import { basename, extname, join, resolve } from 'path';
import base, { Resource, ResourceModule, Source } from 'universal/store/modules/resource';

async function hashFolder(folder: string, hasher: Hash) {
    const files = await fs.readdir(folder);
    for (const f of files) {
        const st = await fs.stat(f); // eslint-disable-line
        if (st.isDirectory()) {
            hashFolder(`${folder}/${f}`, hasher);
        } else {
            hasher.update(await fs.readFile(`${folder}/${f}`)) // eslint-disable-line
        }
    }
    return hasher;
}

async function readHash(file: string) {
    return new Promise<string>((resolve, reject) => {
        fs.createReadStream(file)
            .pipe(createHash('sha1').setEncoding('hex'))
            // @ts-ignore
            .once('finish', function () { resolve(this.read()); })
            .once('error', reject);
    });
}

async function parseCurseforgeModpack(buf: Buffer) {
    const z = await Unzip.open(buf, { lazyEntries: true });
    const [manifest] = await z.filterEntries(['manifest.json']);
    if (manifest) {
        const buf = await z.readEntry(manifest);
        return JSON.parse(buf.toString());
    }
    throw new Error();
}

/**
 * 
 * @param {string} type 
 * @param {any} meta 
 */
function getRegularName(type: string, meta: any) {
    let fmeta;
    switch (type) {
        case 'forge':
            fmeta = meta[0];
            if (!fmeta) {
                return undefined;
            }
            if (typeof (fmeta.name || fmeta.modid) !== 'string'
                || typeof fmeta.mcversion !== 'string'
                || typeof fmeta.version !== 'string') return undefined;
            return `${fmeta.name || fmeta.modid}-${fmeta.mcversion}-${fmeta.version}`;
        case 'liteloader':
            if (typeof meta.name !== 'string'
                || typeof meta.mcversion !== 'string'
                || typeof meta.revision !== 'number') return undefined;
            return `${meta.name}-${meta.mcversion}-${meta.revision}`;
        case 'resourcepack':
            return meta.packName;
        case 'modpacks':
        case 'curseforge-modpack':
            return meta.name;
        default:
            return undefined;
    }
}

async function parseResource(path: string, hash: string, ext: string, data: Buffer, source: Source, type?: string): Promise<Resource<any>> {
    const ft = fileType(data);
    if (ft) {
        ext = `.${ft.ext}`;
    }
    switch (type) {
        case 'texture-packs':
            return buildResource(path, hash, ext, 'resourcepacks', 'resourcepack', source, await ResourcePack.read(path, data));
        case 'mc-mods':
            try {
                return buildResource(path, hash, ext, 'mods', 'forge', source, await Forge.readModMetaData(data));
            } catch (e) {
                try {
                    return buildResource(path, hash, ext, 'mods', 'liteloader', source, await LiteLoader.meta(data));
                } catch (e) {
                    return buildResource(path, hash, ext, 'mods', 'forge', source, {});
                }
            }
        case 'forge':
            return buildResource(path, hash, ext, 'mods', 'forge', source, await Forge.readModMetaData(data));
        case 'liteloader':
            return buildResource(path, hash, ext, 'mods', 'liteloader', source, await LiteLoader.meta(data));
        case 'save':
        case 'worlds':
            return buildResource(path, hash, ext, 'saves', 'save', source, {});
        case 'curseforge-modpack':
        case 'modpacks':
            return buildResource(path, hash, ext, 'modpacks', 'curseforge-modpack', source, await parseCurseforgeModpack(data));
        default:
            return guessResource(path, hash, ext, data, source);
    }
}

async function guessResource(path: string, hash: string, ext: string, data: Buffer, source: Source): Promise<any> {
    const { meta, domain, type } = await Forge.meta(data).then(meta => ({ domain: 'mods', meta, type: 'forge' }),
        _ => LiteLoader.meta(data).then(meta => ({ domain: 'mods', meta, type: 'liteloader' }),
            _ => ResourcePack.read(path, data).then(meta => ({ domain: 'resourcepacks', meta, type: 'resourcepack' }),
                e => ({ domain: undefined, meta: undefined, type: undefined, error: e }))));

    if (!domain || !meta || !type) throw new Error(`Cannot parse ${path}.`);

    return buildResource(path, hash, ext, domain, type, source, meta);
}

function buildResource(filename: string, hash: string, ext: string, domain: string, type: string, source: Source, meta: any): Resource<any> {
    Object.freeze(source);
    Object.freeze(meta);
    return {
        path: filename,
        name: getRegularName(type, meta) || basename(filename, ext),
        hash,
        ext,
        metadata: meta,
        domain,
        type,
        source,
    };
}

const cache: { [key: string]: string } = {};
const mod: ResourceModule = {
    ...base,
    actions: {
        async load(context) {
            await fs.ensureDir(context.rootGetters.path('resources'));
            const resources = await fs.readdir(context.rootGetters.path('resources'));

            context.commit('resources', await Promise.all(resources
                .filter(file => !file.startsWith('.'))
                .map(file => context.rootGetters.path('resources', file))
                .map(file => fs.readFile(file).then(b => JSON.parse(b.toString())))));
        },
        async init(context) {
            context.dispatch('refreshResources');
        },
        async refreshResource(context, res) {
            const resource = typeof res === 'string' ? context.getters.getResource(res) : res;
            if (!resource) return;
            const newOne = await parseResource(resource.path, resource.hash, resource.ext, await fs.readFile(resource.path), resource.source, resource.type);
            context.commit('resource', newOne);
        },
        async refreshResources(context) {
            const task = Task.create('refreshResource', async (ctx) => {
                const modsDir = context.rootGetters.path('mods');
                const resourcepacksDir = context.rootGetters.path('resourcepacks');
                const modpacksDir = context.rootGetters.path('modpacks');
                const savesDir = context.rootGetters.path('saves');
                await fs.ensureDir(modsDir);
                await fs.ensureDir(resourcepacksDir);
                await fs.ensureDir(modpacksDir);
                await fs.ensureDir(savesDir);
                const modsFiles = await fs.readdir(modsDir);
                const resourcePacksFiles = await fs.readdir(resourcepacksDir);
                const modpacksFiles = await fs.readdir(modpacksDir);
                const savesFiles = await fs.readdir(savesDir);

                const touched = {};
                const total = modsFiles.length + resourcePacksFiles.length + modpacksFiles.length;
                let finished = 0;

                const resources: Resource<any>[] = [];
                /**
                 * @param {string[]} pool
                 * @param {string | undefined | void} type
                 */
                async function reimport(pool: string[], type?: string) {
                    while (pool.length !== 0) {
                        const file = pool.pop();
                        if (!file || file.endsWith('.DS_Store')) return;
                        try {
                            const stat = await fs.stat(file);
                            const isDir = stat.isDirectory();
                            if (isDir) {
                                console.error(`Strange, ${file} is a directory, cannot reimport!`);
                                continue;
                            }
                            if (stat.size === 0) {
                                console.error(`Removing empty file ${file} during reimport resources.`);
                                await fs.unlink(file);
                                continue;
                            }

                            const hash = await readHash(file);
                            const metaFile = join('resources', `${hash}.json`);

                            Reflect.set(touched, `${hash}.json`, true);
                            const metadata = await context.dispatch('getPersistence', { path: metaFile });
                            if (!metadata || typeof metadata.domain !== 'string' || typeof metadata.hash !== 'string') {
                                console.log(`Missing metadata file for ${file}. Try to reimport it.`);
                                const ext = extname(file);

                                const resource = await parseResource(file, hash, ext, await fs.readFile(file), {
                                    path: resolve(file),
                                    date: Date.now().toString(),
                                }, type);

                                await context.dispatch('setPersistence', { path: metaFile, data: resource });
                                resources.push(resource);
                            } else if (!context.state.domains[metadata.domain][metadata.hash]) {
                                resources.push(metadata);
                            }
                        } catch (e) {
                            console.error(`Cannot resolve resource file ${file}.`);
                            console.error(e);
                        } finally {
                            finished += 1;
                            ctx.update(finished);
                            await new Promise((resolve, reject) => {
                                setImmediate(() => {
                                    resolve();
                                });
                            });
                        }
                    }
                }

                ctx.update(0, total);

                await Promise.all([
                    reimport(modsFiles.map(file => context.rootGetters.path('mods', file))),
                    reimport(resourcePacksFiles.map(file => context.rootGetters.path('resourcepacks', file)), 'resourcepack'),
                    reimport(modpacksFiles.map(file => context.rootGetters.path('modpacks', file)), 'modpacks'),
                    reimport(savesFiles.map(file => context.rootGetters.path('saves', file)), 'save'),
                ]);

                const metaFiles = await fs.readdir(context.rootGetters.path('resources'));

                for (const metaFile of metaFiles) {
                    if (!Reflect.has(touched, metaFile)) {
                        await fs.unlink(context.rootGetters.path('resources', metaFile));
                    }
                }

                if (resources.length > 0) {
                    context.commit('resources', resources);
                }
                console.log(`refreshed ${resources.length} resources`);
            });
            const handle = await context.dispatch('executeTask', task);
            await context.dispatch('waitTask', handle);
        },

        async removeResource(context, resource) {
            const resourceObject = typeof resource === 'string' ? context.getters.getResource(resource) : resource;
            if (!resourceObject) return;
            context.commit('removeResource', resourceObject);
            await Promise.all([
                fs.unlink(context.rootGetters.path('resources', `${resourceObject.hash}.json`)),
                fs.unlink(context.rootGetters.path(resourceObject.domain, `${resourceObject.name}${resourceObject.ext}`)),
            ]);
        },

        async readForgeLogo(context, resourceId) {
            requireString(resourceId);
            if (typeof cache[resourceId] === 'string') return cache[resourceId];
            const res = context.state.domains.mods[resourceId];
            if (res.type !== 'forge') {
                throw new Error(`The resource should be forge but get ${res.type}`);
            }
            const meta = res.metadata[0];
            if (!meta) {
                throw new Error(`No metadata file for mod ${JSON.stringify(res, null, 4)}`);
            }
            if (!meta.logoFile) {
                cache[resourceId] = '';
                return '';
            }
            const zip = await Unzip.open(res.path, { lazyEntries: true });
            const [logo] = await zip.filterEntries([meta.logoFile]);
            if (logo) {
                const buffer = await zip.readEntry(logo);
                const data = buffer.toString('base64');
                cache[resourceId] = data;
                return data;
            }
            cache[resourceId] = '';
            return '';
        },

        async renameResource(context, option) {
            const resource = typeof option.resource === 'string' ? context.getters.getResource(option.resource) : option.resource;
            if (resource) {
                const newRes = { ...resource, name: option.name };
                await fs.writeFile(resource.path, JSON.stringify(newRes, null, 4));
                context.commit('resource', newRes);
            }
        },

        async importResource(context, { path, type, metadata = {}, background = false }) {
            requireString(path);

            const task = Task.create('importResource', async (ctx) => {
                const root = context.rootState.root;

                let data: Buffer;
                let ext = '';
                let hash = '';
                let name = '';
                let isDir = false;

                ctx.update(0, 4, path);

                name = basename(basename(path, '.zip'), '.jar');
                const status = await fs.stat(path);

                if (status.isDirectory()) {
                    isDir = true;
                    ext = '';
                    hash = (await hashFolder(path, createHash('sha1'))).digest('hex');
                } else {
                    data = await fs.readFile(path);
                    ext = extname(path);
                    hash = createHash('sha1').update(data).digest('hex');
                }

                const source = {
                    name,
                    path: resolve(path),
                    date: Date.now(),
                    ...metadata,
                };

                ctx.update(1, 4, path);
                const checkingResult = await ctx.execute('checking', async () => {
                    // take hash of dir or file
                    await fs.ensureDir(join(root, 'resources'));
                    const metaFile = join(root, 'resources', `${hash}.json`);

                    // if exist, abort
                    if (await fs.exists(metaFile)) {
                        const resource = context.getters.getResource(hash);
                        if (resource) {
                            const newResource = buildResource(resource.path, resource.hash, resource.ext, resource.domain, resource.type, {
                                ...resource.source,
                                ...metadata, // overwrite the source sign
                            }, resource.metadata);
                            context.commit('resource', newResource);
                            return newResource;
                        }
                    }
                    return undefined;
                });
                if (checkingResult) return checkingResult;

                ctx.update(2, 4, path);
                // use parser to parse metadata
                const { resource, dataFile } = await ctx.execute('parsing', async () => {
                    const resource = await parseResource(path, hash, ext, data, source, type);

                    console.log(`Import resource ${name}${ext}(${hash}) into ${resource.domain}`);

                    let dataFile = join(root, resource.domain, `${resource.name}${resource.ext}`);
                    if (await fs.exists(dataFile)) {
                        dataFile = join(root, resource.domain, `${resource.name}.${hash}${resource.ext}`);
                    }

                    resource.path = dataFile;
                    return { resource, dataFile };
                });

                ctx.update(3, 4, path);
                await ctx.execute('storing', async () => {
                    // write resource to disk
                    if (isDir) {
                        await fs.ensureDir(dataFile);
                        await fs.copy(path, dataFile);
                    } else {
                        await fs.ensureFile(dataFile);
                        await fs.writeFile(dataFile, data);
                    }

                    // store metadata to disk
                    await fs.writeFile(join(root, 'resources', `${hash}.json`), JSON.stringify(resource, undefined, 4));

                    context.commit('resource', resource);
                });

                ctx.update(4, 4, path);
                return resource;
            });
            Reflect.set(task, 'background', background);

            return context.dispatch('executeTask', task);
        },

        async deployResources(context, payload) {
            if (!payload) throw new Error('Require input a resource with minecraft location');
            const { resourceUrls: resources, profile } = payload;
            if (!resources) throw new Error('Resources cannot be undefined!');
            if (!profile) throw new Error('Profile id cannot be undefined!');

            const promises = [];
            for (const resource of resources) {
                /**
                * @type {import('universal/store/modules/resource').Resource<any> | undefined}
                */
                let res;
                if (typeof resource === 'string') res = context.getters.queryResource(resource);
                else res = resource;

                if (!res) {
                    promises.push(Promise.reject(new Error(`Cannot find the resource ${resource}`)));
                    continue;
                }
                if (typeof res !== 'object' || !res.hash || !res.type || !res.domain || !res.name) {
                    promises.push(Promise.reject(new Error(`The input resource object should be valid! ${JSON.stringify(resource, null, 4)}`)));
                    continue;
                }
                if (res.domain === 'mods' || res.domain === 'resourcepacks') {
                    const dest = context.rootGetters.path('profiles', profile, res.domain, res.name + res.ext);
                    try {
                        const stat = await fs.stat(dest);
                        if (stat.isSymbolicLink()) {
                            await fs.unlink(dest);
                            promises.push(fs.symlink(res.path, dest));
                        } else {
                            console.error(`Cannot deploy resource ${res.hash} -> ${dest}, since the path is occupied.`);
                        }
                    } catch (e) {
                        promises.push(fs.symlink(res.path, dest));
                    }
                } else if (res.domain === 'saves') {
                    await context.dispatch('importSave', res.path);
                } else if (res.domain === 'modpack') { // modpack will override the profile
                    await context.dispatch('importCurseforgeModpack', {
                        profile,
                        path: res.path,
                    });
                }
            }
            const r = await Promise.all(promises);
            return r;
        },

        async exportResource(context, payload) {
            const { resources, targetDirectory } = payload;

            const promises = [];
            for (const resource of resources) {
                /**
                * @type {import('universal/store/modules/resource').Resource<any>|undefined}
                */
                let res;
                if (typeof resource === 'string') res = context.getters.getResource(resource);
                else res = resource;

                if (!res) throw new Error(`Cannot find the resource ${resource}`);

                promises.push(fs.copy(res.path, join(targetDirectory, res.name + res.ext)));
            }
            await Promise.all(promises);
        },

    },
};

export default mod;
