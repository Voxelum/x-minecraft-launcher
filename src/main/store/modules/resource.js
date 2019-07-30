import crypto from 'crypto';
import { net } from 'electron';
import { createReadStream, existsSync, promises as fs } from 'fs';
import { copy, ensureDir, ensureFile } from 'main/utils/fs';
import paths from 'path';
import { Forge, LiteLoader, ResourcePack, World } from 'ts-minecraft';
import base from 'universal/store/modules/resource';
import { requireString } from 'universal/utils/object';
import url from 'url';
import { bufferEntry, open, parseEntries, createExtractStream } from 'yauzlw';
import Task from 'treelike-task';
import { cpus } from 'os';

/**
 * 
 * @param {string} folder 
 * @param {crypto.Hash} hasher 
 */
async function hashFolder(folder, hasher) {
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

/**
 * 
 * @param {string} file 
 */
async function readHash(file) {
    return new Promise((resolve, reject) => {
        createReadStream(file)
            .pipe(crypto.createHash('sha1').setEncoding('hex'))
            // @ts-ignore
            .once('finish', function () { resolve(this.read()); })
            .once('error', reject);
    });
}

/**
 * @param {Buffer} buf 
 */
async function parseCurseforgeModpack(buf) {
    const z = await open(buf, { lazyEntries: true, autoClose: false });
    const { 'manifest.json': manifest } = await parseEntries(z, ['manifest.json']);
    if (manifest) {
        const buf = await bufferEntry(z, manifest);
        return JSON.parse(buf.toString());
    }
    throw new Error();
}

/**
 * 
 * @param {string} type 
 * @param {any} meta 
 */
function getRegularName(type, meta) {
    let fmeta;
    switch (type) {
        case 'forge':
            fmeta = meta[0];
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

/**
 * 
 * @param {string} path 
 * @param {string} hash 
 * @param {string} ext 
 * @param {Buffer} data 
 * @param {object} source 
 * @param {string | undefined | void} type
 * @return {Promise<import('universal/store/modules/resource').Resource<any>>}
 */
async function parseResource(path, hash, ext, data, source, type) {
    switch (type) {
        case 'forge':
        case 'mc-mods':
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
            return guessResources(path, hash, ext, data, source);
    }
}

/**
 * 
 * @param {string} path 
 * @param {string} hash 
 * @param {string} ext 
 * @param {Buffer} data 
 * @param {object} source 
 * @return {Promise<import('universal/store/modules/resource').Resource<any>>}
 */
async function guessResources(path, hash, ext, data, source) {
    const { meta, domain, type } = await Forge.meta(data).then(meta => ({ domain: 'mods', meta, type: 'forge' }),
        _ => LiteLoader.meta(data).then(meta => ({ domain: 'mods', meta, type: 'liteloader' }),
            _ => ResourcePack.read(path, data).then(meta => ({ domain: 'resourcepacks', meta, type: 'resourcepack' }),
                e => ({ domain: undefined, meta: undefined, type: undefined, error: e }))));

    if (!domain || !meta || !type) throw new Error(`Cannot parse ${path}.`);

    return buildResource(path, hash, ext, domain, type, source, meta);
}

/**
 * 
 * @param {string} filename 
 * @param {string} hash 
 * @param {string} ext 
 * @param {string} domain 
 * @param {string} type 
 * @param {any} source 
 * @param {any} meta 
 * @returns {import('universal/store/modules/resource').Resource<any>}
 */
function buildResource(filename, hash, ext, domain, type, source, meta) {
    Object.freeze(source);
    Object.freeze(meta);
    return {
        path: filename,
        name: getRegularName(type, meta) || paths.basename(paths.basename(filename, '.zip'), '.jar'),
        hash,
        ext,
        metadata: meta,
        domain,
        type,
        source,
    };
}


/**
 * @type {{[key: string]: string}}
 */
const cache = {};
/**
 * @type {import('universal/store/modules/resource').ResourceModule}
 */
const mod = {
    ...base,
    actions: {
        async load(context) {
            const resources = await fs.readdir(context.rootGetters.path('resources'));
            context.commit('resources', await Promise.all(resources
                .map(file => context.rootGetters.path('resources', file))
                .map(file => fs.readFile(file).then(b => JSON.parse(b.toString())))));
        },
        async init(context) {
            context.dispatch('refreshResources');
        },
        async refreshResources(context) {
            const task = Task.create('refreshResource', async (ctx) => {
                const modsDir = context.rootGetters.path('mods');
                const resourcepacksDir = context.rootGetters.path('resourcepacks');
                const modpacksDir = context.rootGetters.path('modpacks');
                await ensureDir(modsDir);
                await ensureDir(resourcepacksDir);
                await ensureDir(modpacksDir);
                const modsFiles = await fs.readdir(modsDir);
                const resourcePacksFiles = await fs.readdir(resourcepacksDir);
                const modpacksFiles = await fs.readdir(modpacksDir);

                const touched = {};
                const total = modsFiles.length + resourcePacksFiles.length + modpacksFiles.length;
                let finished = 0;
                const emptyResource = { path: '', name: '', hash: '', ext: '', metadata: {}, domain: '', type: '', source: { path: '', date: '' } };

                /**
                 * @type {import('universal/store/modules/resource').Resource<any>[]}
                 */
                const resources = [];
                /**
                 * @param {string[]} pool
                 * @param {string | undefined | void} type
                 */
                async function reimport(pool, type) {
                    while (pool.length !== 0) {
                        const file = pool.pop();
                        if (!file) return;
                        try {
                            const stat = await fs.stat(file);
                            const isDir = stat.isDirectory();
                            if (isDir) {
                                console.error(`Strange, ${file} is a directory, cannot reimport!`);
                                // eslint-disable-next-line no-continue
                                continue;
                            }
                            if (stat.size === 0) {
                                console.error(`Removing empty file ${file} during reimport resources.`);
                                await fs.unlink(file);
                                // eslint-disable-next-line no-continue
                                continue;
                            }

                            const hash = await readHash(file);
                            const metaFile = paths.join('resources', `${hash}.json`);

                            Reflect.set(touched, `${hash}.json`, true);
                            const metadata = await context.dispatch('getPersistence', { path: metaFile });
                            if (!metadata) {
                                console.log(`Missing metadata file for ${file}. Try to reimport it.`);
                                const ext = paths.extname(file);
                                const name = paths.basename(file, ext);

                                const resource = await parseResource(file, hash, ext, await fs.readFile(file), {
                                    name,
                                    path: paths.resolve(file),
                                    date: Date.now(),
                                }, type);

                                await context.dispatch('setPersistence', { path: metaFile, data: resource });
                                resources.push(resource);
                            }
                            resources.push(metadata);
                        } catch (e) {
                            console.error(`Cannot resolve resource file ${file}.`);
                            console.error(e);
                        } finally {
                            finished += 1;
                            ctx.update(finished);
                        }
                    }
                }

                ctx.update(0, total);

                await Promise.all([
                    reimport(modsFiles.map(file => context.rootGetters.path('mods', file))),
                    reimport(resourcePacksFiles.map(file => context.rootGetters.path('resourcepacks', file)), 'resourcepack'),
                    reimport(modpacksFiles.map(file => context.rootGetters.path('modpacks', file)), 'modpacks'),
                ]);

                const metaFiles = await fs.readdir(context.rootGetters.path('resources'));

                for (const metaFile of metaFiles) {
                    if (!Reflect.has(touched, metaFile)) {
                        await fs.unlink(context.rootGetters.path('resources', metaFile));
                    }
                }

                if (resources.length > 0) {
                    context.commit('resources', resources.filter(resource => resource !== emptyResource));
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
            const res = context.state.mods[resourceId];
            if (res.type !== 'forge') {
                throw new Error(`The resource should be forge but get ${res.type}`);
            }
            const meta = res.metadata[0];
            if (!meta.logoFile) {
                cache[resourceId] = '';
                return '';
            }
            const zip = await open(res.path, { lazyEntries: true, autoClose: false });
            const { [meta.logoFile]: logo } = await parseEntries(zip, [meta.logoFile]);
            if (logo) {
                const buffer = await bufferEntry(zip, logo);
                const data = buffer.toString('base64');
                cache[resourceId] = data;
                return data;
            }
            cache[resourceId] = '';
            return '';
        },

        async importResource(context, { path, type, metadata = {}, background = false }) {
            requireString(path);

            const task = Task.create('importResource', async (ctx) => {
                const root = context.rootState.root;

                /** @type {Buffer} */
                let data;
                let ext = '';
                let hash = '';
                let name = '';
                let isDir = false;

                ctx.update(0, 4, path);

                const theURL = url.parse(path);
                if (theURL.protocol === 'https:' || theURL.protocol === 'http:') {
                    data = await new Promise((resolve, reject) => {
                        const req = net.request({ url: path, redirect: 'manual' });
                        /**
                         * @type {Buffer[]}
                         */
                        const bufs = [];
                        req.on('response', (resp) => {
                            resp.on('error', reject);
                            resp.on('data', (chunk) => { bufs.push(chunk); });
                            resp.on('end', () => { resolve(Buffer.concat(bufs)); });
                        });
                        req.on('redirect', (code, method, redirectUrl, header) => {
                            name = paths.basename(redirectUrl, '.zip');
                            ext = paths.extname(redirectUrl);
                            req.followRedirect();
                        });

                        req.on('error', reject);
                        req.end();
                    });

                    hash = crypto.createHash('sha1').update(data).digest('hex');
                } else {
                    name = paths.basename(paths.basename(path, '.zip'), '.jar');
                    const status = await fs.stat(path);

                    if (status.isDirectory()) {
                        isDir = true;
                        ext = '';
                        hash = (await hashFolder(path, crypto.createHash('sha1'))).digest('hex');
                    } else {
                        data = await fs.readFile(path);
                        ext = paths.extname(path);
                        hash = crypto.createHash('sha1').update(data).digest('hex');
                    }
                }

                const source = {
                    name,
                    path: paths.resolve(path),
                    date: Date.now(),
                    ...metadata,
                };

                ctx.update(1, 4, path);
                const checkingResult = await ctx.execute('checking', async () => {
                    // take hash of dir or file
                    await ensureDir(paths.join(root, 'resources'));
                    const metaFile = paths.join(root, 'resources', `${hash}.json`);

                    // if exist, abort
                    if (existsSync(metaFile)) {
                        /** @type {any} */
                        const resource = context.getters.getResource(hash);
                        return resource;
                    }
                    return undefined;
                });
                if (checkingResult) return checkingResult;

                ctx.update(2, 4, path);
                // use parser to parse metadata
                const { resource, dataFile } = await ctx.execute('parsing', async () => {
                    const resource = await parseResource(path, hash, ext, data, source, type);

                    console.log(`Import resource ${name}${ext}(${hash}) into ${resource.domain}`);

                    let dataFile = paths.join(root, resource.domain, `${resource.name}${ext}`);
                    if (existsSync(dataFile)) {
                        dataFile = paths.join(root, resource.domain, `${resource.name}.${hash}${ext}`);
                    }

                    resource.path = dataFile;
                    return { resource, dataFile };
                });

                ctx.update(3, 4, path);
                await ctx.execute('storing', async () => {
                    // write resource to disk
                    if (isDir) {
                        await ensureDir(dataFile);
                        await copy(path, dataFile);
                    } else {
                        await ensureFile(dataFile);
                        await fs.writeFile(dataFile, data);
                    }

                    // store metadata to disk
                    await fs.writeFile(paths.join(root, 'resources', `${hash}.json`), JSON.stringify(resource, undefined, 4));

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

            const { resources, profile } = payload;
            if (!resources) throw new Error('Resources cannot be undefined!');
            if (!profile) throw new Error('Profile id cannot be undefined!');

            const promises = [];
            for (const resource of resources) {
                /**
                * @type {import('universal/store/modules/resource').Resource<any> | undefined}
                */
                let res;
                if (typeof resource === 'string') res = context.getters.getResource(resource);
                else res = resource;

                if (!res) throw new Error(`Cannot find the resource ${resource}`);
                if (typeof res !== 'object' || !res.hash || !res.type || !res.domain || !res.name) {
                    throw new Error('The input resource object should be valid!');
                }
                if (res.domain === 'mods' || res.domain === 'resourcepacks') {
                    const dest = context.rootGetters.path(profile, res.domain, res.name + res.ext);
                    if (existsSync(dest)) {
                        await fs.unlink(dest);
                    }
                    promises.push(fs.link(res.path, dest));
                } else if (res.domain === 'saves') {
                    const dest = context.rootGetters.path(profile, res.domain, res.name + res.ext);
                    await createReadStream(res.path)
                        .pipe(createExtractStream(dest)).promise();
                } else if (res.domain === 'modpack') {
                    await context.dispatch('importCurseforgeModpack', {
                        profile,
                        path: res.path,
                    });
                }
            }
            await Promise.all(promises);
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

                promises.push(copy(res.path, paths.join(targetDirectory, res.name + res.ext)));
            }
            await Promise.all(promises);
        },

    },
};

export default mod;
