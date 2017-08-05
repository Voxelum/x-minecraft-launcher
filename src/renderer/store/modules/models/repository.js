import * as fs from 'fs'
import * as path from 'path'
import crypto from 'crypto'

export class Resource {
    constructor(hash, fileName, type, meta) {
        this.hash = hash;
        this.fileName = fileName;
        this.type = type;
        this.meta = meta;
    }
}
function $hash(buff) {
    return crypto.createHash('sha1').update(buff).digest('hex').toString('utf-8');
}
function $load(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, (err, data) => {
            if (err) reject(err);
            else resolve({ name: path.basename(filePath), data, type: path.extname(filePath) });
        })
    }).then(({ name, data, type }) => {
        const resource = new Resource($hash(data), name, type, undefined);
        return { filePath, data, resource };
    });
}
export default {
    state() {
        return {
            root: '',
            keys: [],
            store: new Map(),
        }
    },
    getters: {
        allKeys: state => state.keys,
        entries: state => state.keys.map((key) => {
            return { key, value: state.store.get(key) }
        }),
        get: state => key => state.store.get(key),
    },
    mutations: {
        set(state, payload) {
            if (!state.store.has(payload.key)) {
                state.store.set(payload.key, payload.value)
                state.keys.push(payload.key)
            }
        },
        delete(state, payload) {
            state.store.delete(payload)
        },
    },
    actions: {
        load(context) {
            return context.dispatch('readFolder', { path: context.state.root }, { root: true })
                .then(files => Promise.all(
                    files
                        .filter(file => file.endsWith('.json'))
                        .map(file => context.dispatch('readFile', {
                            path: `${context.state.root}/${file}`,
                            fallback: undefined,
                            encoding: 'json',
                        }, { root: true }).then((json) => {
                            if (!json) return undefined;
                            const resource =
                                new Resource(json.hash, json.fileName, json.type, json.meta)
                            context.commit('set', { key: resource.hash, value: resource })
                            return resource
                        }))));
        },
        import(context, payload) {
            let arr
            if (typeof payload === 'string') arr = [payload]
            else if (payload instanceof Array) arr = payload
            return Promise.all(arr.map(fpath =>
                $load(fpath).then(({ filePath, data, resource }) =>
                    context.dispatch('meta', { name: path.basename(filePath), data })
                        .then((meta) => {
                            resource.meta = meta;
                            if (!context.state.store.has(resource.hash)) {
                                context.commit('set', { key: resource.hash, value: resource })
                                return context.dispatch('writeFile',
                                    {
                                        path: path.join(context.state.root, `${resource.hash}${resource.type}`),
                                        data,
                                    },
                                    { root: true })
                                    .then(() => context.dispatch('writeFile',
                                        {
                                            path: path.join(context.state.root, `${resource.hash}.json`),
                                            data: resource,
                                        },
                                        { root: true }))
                                    .then(() => resource)
                            }
                            return resource;
                        },
                    ))))
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
                const targetPath = path.join(targetDirectory, option.fileName || res.fileName);
                const mode = option.mode || 0;
                switch (mode) {
                    case 0:
                    case 1:
                    case 2:
                        return new Promise((resolve, reject) => {
                            fs.link(path.join(context.state.root, `${res.hash}.${res.type}`), targetPath, (err) => {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve();
                                }
                            });
                        });
                    case 3:
                    case 4:
                    default:
                        break;
                }
                return res
            });
        },
        refresh(context, payload) {
            // return context.dispatch('readFolder', { path: this.context.state.root }, { root: true })
            //     .then(files => Promise.all(
            //         files.map(file => context.dispatch('readFile', {
            //             path: `${this.context.state.root}/${file}`,
            //             fallback: undefined,
            //         }).then((buf) => {
            //             if (!buf) return;
            //             const resource = new Resource($hash(buf), file, path.extname(file))
            //             context.commit('put', { key: resource.hash, value: resource })
            //         }))));
        },
    },
}
