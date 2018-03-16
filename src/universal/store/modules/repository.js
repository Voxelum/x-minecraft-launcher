import crypto from 'crypto'
import Vue from 'vue'
import { ActionContext } from 'vuex'
import fs from 'fs-extra'
import path from 'path'
import { Mod, ResourcePack } from 'ts-minecraft'


/**
 * @type {ResourceParser[]}
 */
const parsers = [
    { domain: 'mods', parse: (name, data, type) => Mod.parse(data) },
    {
        domain: 'resourcepacks',
        parse: (name, data, type) => {
            if (type === '') {
                return ResourcePack.readFolder(name);
            }
            return ResourcePack.read(name, data)
        },
    },
];

async function readFolderFull(folder) {
    const arr = [];
    const files = await fs.readdir(folder);
    for (const f of files) {
        const st = await fs.stat(f); // eslint-disable-line
        if (st.isDirectory()) {
            arr.push(...readFolderFull(`${folder}/${f}`));
        } else {
            arr.push({ path: `${folder}/${f}`, data: await fs.readFile(`${folder}/${f}`) }) // eslint-disable-line
        }
    }
    return arr;
}

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
 * @param {string} root 
 * @param {string} filePath 
 */
async function $import(root, filePath, signiture) {
    const status = await fs.stat(filePath);
    const name = path.basename(filePath);
    let data;
    let type;
    let hash;
    if (status.isDirectory()) {
        type = '';
        data = await readFolderFull(filePath);
        const hasher = crypto.createHash('sha1');
        data.forEach(f => hasher.update(f.data))
        hash = hasher.digest('hex').toString('utf-8');
    } else {
        data = await fs.readFile(filePath);
        type = path.extname(filePath);
        hash = crypto.createHash('sha1').update(data).digest('hex').toString('utf-8');
    }
    const metaFile = `${hash}.json`;
    const dataFile = `${hash}${type}`;
    if (fs.existsSync(dataFile) && fs.existsSync(metaFile)) return undefined;

    let meta;
    let domain;
    for (const parser of parsers) {
        try {
            meta = parser.parse(name, data, type);
            if (meta instanceof Promise) meta = await meta; // eslint-disable-line
            domain = parser.domain;
            break;
        } catch (e) { console.warn(`Fail with domain [${parser.domain}]`); console.warn(e) }
    }
    if (!domain || !meta) { throw new Error(`Cannot parse ${filePath}.`) }

    const resource = { hash, name, type, meta, domain, signiture };
    await fs.ensureDir(path.join(root, 'resources'));
    if (status.isDirectory()) {
        data.forEach((f) => {
            
        })
    } else {
        await fs.writeFile(path.join(root, 'resources', `${resource.hash}${resource.type}`), data);
    }
    await fs.writeFile(path.join(root, 'resources', `${resource.hash}.json`), JSON.stringify(resource));
    return resource;
}

export default {
    namespaced: true,
    state: () => ({
        mods: {},
        resourcepacks: {},
    }),
    getters: {
        domains: state => Object.keys(state),
        mods: state => Object.keys(state.mods).map(k => state.mods[k]) || [],
        resourcepacks: state => Object.keys(state.resourcepacks)
            .map(k => state.resourcepacks[k]) || [],
        getResource: (state, getters) => (hash) => {
            for (const domain of getters.domains) {
                if (state[domain][hash]) return state[domain][hash];
            }
            return undefined;
        },
    },
    mutations: {
        rename(context, { resource, name }) { resource.name = name; },
        /**
         * @param {{payload: Resource[]}} payload 
         */
        resources: (state, payload) => {
            payload.forEach((res) => {
                if (!state[res.domain]) Vue.set(state, res.domain, {})
                Vue.set(state[res.domain], res.hash, res);
            })
        },
        remove(state, resource) { Vue.delete(state[resource.domain], resource.hash); },
    },
    actions: {
        /**
         * @param {ActionContext} context 
         */
        async load(context) {
            const files = await context.dispatch('readFolder', { path: 'resources' }, { root: true });
            const contents = []
            for (const file of files.filter(f => f.endsWith('.json'))) {
                try {
                    contents.push(await context.dispatch('read', { // eslint-disable-line
                        path: `resources/${file}`,
                        fallback: undefined,
                        type: 'json',
                    }, { root: true }))
                } catch (e) { console.warn(e) }
            }
            context.commit('resources', contents)
        },
        save(context, { mutation, object }) {
        },
        /**
         * @param {ActionContext} context 
         * @param {string|Resource} resource 
         */
        remove(context, resource) {
            if (typeof resource === 'string') {
                resource = context.getters.getResource(resource)
            }
            context.commit('remove', resource)
            return Promise.all([
                context.dispatch('delete', `resources/${resource.hash}.json`, { root: true }),
                context.dispatch('delete', `resources/${resource.hash}${resource.type}`, { root: true }),
            ])
        },
        /**
        * @param {ActionContext} context 
        * @param {{resource:string|Resource, name:string}} payload
        */
        rename(context, payload) {
            if (typeof payload.resource === 'string') payload.resource = context.getters.getResource(payload.resource);
            if (!payload) throw new Error('Cannot find resource');
            context.commit('rename', payload);
            return context.dispatch('write', { path: `resources/${payload.resource.hash}.json`, data: JSON.stringify(payload.resource) }, { root: true })
        },
        /**
         * @param {ActionContext} context 
         * @param {string[] | string | {signiture:any, files:string[]}} infiles 
         */
        async import(context, infiles) {
            const root = context.rootGetters.root;
            const files = [];
            let signiture = {
                source: 'local',
                date: Date.now(),
                meta: null,
            };
            if (infiles instanceof Array) {
                files.push(...infiles);
                signiture.meta = files;
            } else if (typeof infiles === 'string') {
                files.push(infiles)
                signiture.meta = files;
            } else {
                if (!infiles.files || !(infiles.files instanceof Array)) throw new Error('Illegal Argument format!')
                if (!infiles.signiture) throw new Error('Have to have a signiture to import!')
                files.push(...infiles.files);
                signiture = infiles.signiture;
                // data.signiture = files.signiture
            }

            const resources = (await Promise.all(files.map(f => $import(root, f, signiture))))
                .filter(res => res !== undefined)

            context.commit('resources', resources);

            return Promise.resolve();
        },

        /**
         * @param {ActionContext} context 
         * @param {{resource:string|Resource, minecraft:string}} payload 
         */
        link(context, payload) {
            const { resource, minecraft } = payload

            /**
            * @type {Resource}
            */
            let res;
            if (typeof resource === 'string') res = context.getters.getResource(resource)
            else res = resource;

            if (!res) throw new Error(`Cannot find the resource ${resource}`);

            return context.dispatch('export', {
                file: `resources/${res.hash}${res.type}`,
                toFolder: `${minecraft}/${res.domain}`,
                mode: 'link',
                name: `${res.name}${res.type}`,
            }).then(() => res);
        },
        /**
         * @param {ActionContext} context 
         * @param {{resource:string|Resource, targetDirectory:string}} payload 
         */
        export(context, payload) {
            const { resource, targetDirectory } = payload

            /**
            * @type {Resource}
            */
            let res;
            if (typeof resource === 'string') res = context.getters.getResource(resource)
            else res = resource;

            if (!res) throw new Error(`Cannot find the resource ${resource}`);

            return context.dispatch('export', {
                file: `resources/${res.hash}${res.type}`,
                toFolder: targetDirectory,
                mode: 'copy',
                name: `${res.hash}${res.type}`,
            }).then(() => res);
        },
        refresh(context, payload) {
        },
    },
}
