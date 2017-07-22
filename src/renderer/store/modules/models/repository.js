import * as fs from 'fs'
import * as path from 'path'
import crypto from 'crypto'

export class Resource {
    constructor(hash, fileName, type) {
        this.hash = hash;
        this.fileName = fileName;
        this.type = type;
    }
}
function _hash(buff) {
    return crypto.createHash('sha1').update(buff).digest('hex').toString('utf-8');
}
function _load(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, (err, data) => {
            if (err) reject(err);
            else resolve({ name: path.basename(filePath), data, type: path.extname(filePath) });
        })
    }).then(({ name, data, type }) => {
        const resource = new Resource(_hash(data), name, type);
        return { filePath, data, resource };
    });
}
export default {
    state() {
        return {
            root: '',
            store: new Map(),
        }
    },
    getters: {
        all: state => state.store,
        get: (state, hash) => state.get(hash),
    },
    mutations: {

    },
    actions: {
        import(context, payload) {
            const fpath = payload
            return _load(fpath).then(({ filePath, data, resource }) => {
                if (!context.state.store.has(resource.hash)) {
                    context.state.store.set(resource.hash, resource);
                    return new Promise((resolve, reject) => {
                        const targetPath = path.join(context.state.root, `${resource.hash}.${resource.type}`);
                        if (!fs.existsSync(targetPath)) {
                            fs.writeFile(targetPath, data, { mod: 'w' }, (err) => {
                                if (err) reject(err);
                                else resolve(resource);
                            })
                        } else {
                            resolve(resource)
                        }
                    });
                }
                return resource;
            })
        },
        export(context, payload) {
            const { resource, targetDirectory } = payload
            return new Promise((resolve, reject) => {
                let res
                if (typeof resource === 'string') {
                    if (context.state.store.has(resource)) {
                        resolve(context.state.store.get(resource))
                    } else {
                        reject(new Error('no such resource in cache!'))
                    }
                } else if (resource instanceof Resource) {
                    resolve(resource)
                } else {
                    reject(new Error('illegal argument!'));
                }
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
            if (fs.existsSync(context.state.root)) {
                return new Promise((resolve, reject) => {
                    fs.readdir(context.state.root, (err, files) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(files.map(file =>
                                _load(path.join(context.state.root, file))
                                    .then((resource) => {
                                        context.state.store.set(resource.hash, resource);
                                        return resource;
                                    }),
                            ));
                        }
                    })
                }).then(result => Promise.all(result));
            }
            return new Promise((resolve, reject) => {
                fs.mkdir(context.state.root, (err) => {
                    if (err) reject(err)
                    else resolve([])
                })
            });
        },
    },
}
