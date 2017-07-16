import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

export class Resource {
    constructor(hash, fileName, type) {
        this.hash = hash;
        this.fileName = fileName;
        this.type = type;
    }
}

export default class Repository {
    constructor(root) {
        this._root = root;
        this._store = new Map();
    }
    static _hash(buff) {
        return crypto.createHash('sha1').update(buff).digest('hex').toString('utf-8');
    }
    static _load(filePath) {
        return new Promise((resolve, reject) => {
            fs.readFile(filePath, (err, data) => {
                if (err) reject(err);
                else resolve({ name: path.basename(filePath), data, type: path.extname(filePath) });
            })
        }).then(({ name, data, type }) => {
            const resource = new Resource(Repository._hash(data), name, type);
            return { filePath, data, resource };
        });
    }
    _import(filePath, data, resource) {
        return new Promise((resolve, reject) => {
            const targetPath = path.join(this._root, `${resource.hash}.${resource.type}`);
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
    import(fpath) {
        return Repository._load(fpath).then(({ filePath, data, resource }) => {
            if (!this._store.has(resource.hash)) {
                this._store.set(resource.hash, resource);
                return this._import(filePath, data, resource);
            }
            return resource;
        })
    }
    export(resource, targetDirectory, option) {
        return new Promise((resolve, reject) => {
            let res
            if (typeof resource === 'string') {
                if (this._store.has(resource)) {
                    resolve(this._store.get(resource))
                } else {
                    reject(new Error('no such resource in cache!'))
                }
            } else if (resource instanceof Resource) {
                resolve(resource)
            } else {
                reject(new Error('illegal argument!'));
            }
        }).then((res) => { // TODO mkdir
            if (!option) option = {}
            const targetPath = path.join(targetDirectory, option.fileName || res.fileName);
            const mode = option.mode || 0;
            switch (mode) {
                case 0:
                case 1:
                case 2:
                    return new Promise((resolve, reject) => {
                        fs.link(path.join(this._root, `${res.hash}.${res.type}`), targetPath, (err) => {
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
    }
    all() {
        return this._store;
    }
    get(hash) {
        return this._store.get(hash);
    }
    refresh() {
        if (fs.existsSync(this._root)) {
            return new Promise((resolve, reject) => {
                fs.readdir(this._root, (err, files) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(files.map(file => this._load(path.join(this.root, file))
                            .then((resource) => {
                                this._store.set(resource.hash, resource);
                                return resource;
                            }),
                        ));
                    }
                })
            }).then(result => Promise.all(result));
        }
        return new Promise((resolve, reject) => {
            fs.mkdir(this._root, (err) => {
                if (err) reject(err)
                else resolve([])
            })
        });
    }
}
