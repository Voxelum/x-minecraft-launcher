import * as fs from 'fs-extra'
import * as path from 'path'
import crypto from 'crypto'
import Vue from 'vue'

export class Resource {
    constructor(hash, name, type, meta) {
        this.hash = hash;
        this.name = name;
        this.type = type;
        this.meta = meta;
    }
}
function $hash(buff) {
    return crypto.createHash('sha1').update(buff).digest('hex').toString('utf-8');
}
async function $load(context, filePath) {
    const [name, data, type] = await fs.readFile(filePath)
        .then($data => [path.basename(filePath), $data, path.extname(filePath)]);
    const hash = $hash(data);
    if (!context.state.resources[hash]) {
        let meta
        try {
            meta = await context.dispatch('meta', { name, data })
        } catch (e) {
            return Promise.reject(e)
        }
        const resource = new Resource(hash, name, type, meta)
        context.commit('set', { key: resource.hash, value: resource })
        await context.dispatch('write', {
            path: path.join(context.state.root, `${resource.hash}${resource.type}`),
            data,
        }, { root: true })
        await context.dispatch('write', {
            path: path.join(context.state.root, `${resource.hash}.json`),
            data: resource,
        }, { root: true })
        return resource;
    }
    return context.state.resources[hash]
}
export default {
    state() {
        return {
            root: '',
            resources: {},
        }
    },
    getters: {
        allKeys: state => Object.keys(state.resources),
        values: (state, gets) => gets.allKeys.map(key => state.resources[key]),
        get: state => key => state.resources[key],
    },
    mutations: {
        rename(context, { resource, name }) {
            resource.name = name;
        },
        set(state, payload) {
            if (!state.resources[payload.key]) {
                Vue.set(state.resources, payload.key, payload.value)
            }
        },
        delete(state, payload) {
            Vue.delete(state.resources, payload);
        },
    },
    actions: {
        load: context => context.dispatch('readFolder', { path: context.state.root }, { root: true })
            .then(files => Promise.all(
                files.filter(file => file.endsWith('.json'))
                    .map(file => context.dispatch('read', {
                        path: `${context.state.root}/${file}`,
                        fallback: undefined,
                        encoding: 'json',
                    }, { root: true })
                        .then((json) => {
                            if (!json) return undefined;
                            const resource =
                                new Resource(json.hash, json.name, json.type, json.meta)
                            context.commit('set', { key: resource.hash, value: resource })
                            return resource
                        })))),
        save(context, { mutation, object }) {
            // if (!mutation.endsWith('rename')) return Promise.resolve()
            // const { key, name } = object
            // return context.dispatch('write', { path: `resourcepacks/${key}.json`, data: context.state.resources[key] }, { root: true })
        },
        delete(context, resource) {
            if (typeof resource === 'string') {
                resource = context.state.resources[resource];
            }
            context.commit('delete', resource.hash)
            return context.dispatch('delete', { path: `resourcepacks/${resource.hash}.json` }, { root: true })
                .then(() => context.dispatch('delete', { path: `resourcepacks/${resource.hash}${resource.type}` }, { root: true }))
        },
        rename(context, { resource, name }) { },
        import(context, payload) {
            let arr
            if (typeof payload === 'string') arr = [payload]
            else if (payload instanceof Array) arr = payload
            else return Promise.reject('Illegal Type')
            return Promise.all(arr.map(file => $load(context, file)))
        },
        export(context, payload) {
            const { resource, targetDirectory } = payload
            return new Promise((resolve, reject) => {
                if (typeof resource === 'string') {
                    if (context.state.store.has(resource)) {
                        resolve(context.state.store.get(resource))
                    } else reject(new Error('no such resource in cache!'))
                } else if (resource instanceof Resource) resolve(resource)
                else reject(new Error('illegal argument!'));
            }).then((res) => { // TODO mkdir
                const option = payload.option || {}
                return context.dispatch('export', {
                    file: `${context.state.root}/${res.hash}${res.type}`,
                    toFolder: targetDirectory,
                    mode: 'link',
                    name: `${res.hash}${res.type}`,
                }).then(() => res)
            });
        },
        refresh(context, payload) {
            /* return context.dispatch('readFolder', { path: this.context.state.root }, { root: true })
                .then(files => Promise.all(
                    files.map(file => context.dispatch('read', {
                        path: `${this.context.state.root}/${file}`,
                        fallback: undefined,
                    }).then((buf) => {
                        if (!buf) return;
                        const resource = new Resource($hash(buf), file, path.extname(file))
                        context.commit('put', { key: resource.hash, value: resource })
                    })))); */
        },
    },
}
