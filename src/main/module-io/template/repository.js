import fs from 'fs'
import path from 'path'
export class Resource {
    constructor(hash, fileName, type) {
        this.hash = hash;
        this.fileName = fileName;
        this.type = type;
    }
}

export default class Repository {
    constructor(root) {
        this._root = root
        this._store = new Map()
    }

    _hash(buff) {

    }
    _load(filePath) {
        return new Promise((resolve, reject) => {
            fs.readFile(filePath, (err, data) => {
                if (err) reject(err)
                else resolve({ name: path.basename(filePath), data, type: path.extname(filePath) })
            })
        }).then(({ name, data, type }) => {
            return { filePath, data, resource: new Resource(_hash(data), name, type) }
        });
    }
    _import(filePath, data, resource) {
        return new Promise((resolve, reject) => {
            fs.writeFile(path.join(this._root, resource.hash), data, (err) => {
                if (err) reject(err)
                else resolve(resource)
            })
        });

    }
    add(filePath) {
        return this._load(filePath).then(({ filePath, data, resource }) => {
            if (!this._store.has(resource.hash)) {
                this._store.set(resource.hash, resource)
                return this._import(filePath, data, resource)
            }
            return resource
        })
    }
    all() {
        return this._store
    }
    get(hash) {
        return this._store.get(hash)
    }
    refresh() {
        if (fs.existsSync(this._root))
            fs.readdir(this._root, (err, files) => {
                if (err) Promise.reject(err)
                else return Promise.all(files.map(file => this._load(path.join(this.root, file)).then(resource => {
                    this._store.set(resource.hash, resource)
                    return resource
                })))
            })
        else {
            return new Promise((resolve, reject) => {
                fs.mkdir(this._root, err => {
                    if (err) reject(err)
                    else resolve([])
                })
            });
        }
    }
}