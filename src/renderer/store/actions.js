import fs from 'fs'
import paths from 'path'
import mkdirp from 'mkdirp'
import { remote } from 'electron'
import { NBT } from 'ts-minecraft'
import launcher from '../launcher'

const rootPath = paths.join(remote.app.getPath('appData'), '.launcher')
function dir(path) {
    return new Promise((resolve1, reject1) => {
        mkdirp(path, (err) => {
            if (err) reject1(err)
            else resolve1()
        })
    });
}
function write(path, data) {
    console.log(`writeFile to ${path}`)
    return new Promise((resolve, reject) => {
        fs.writeFile(path, data, (err) => {
            if (err) reject(err)
            else resolve()
        })
    });
}
export default {
    query(context, payload) {
        return launcher.query(payload.service, payload.action, payload.payload)
    },
    readFolder(context, { path }) {
        path = paths.join(rootPath, path);
        console.log(`Read folder ${path}`)
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(path)) {
                mkdirp(path, (err) => {
                    if (err) reject(err)
                    else resolve()
                })
            } else resolve()
        }).then(() => new Promise((resolve, reject) => {
            fs.readdir(path, (err, files) => {
                if (err) reject(err)
                else resolve(files)
            })
        }));
    },
    writeFile(context, { path, data }) {
        path = paths.resolve(rootPath, path)
        if (typeof data === 'object' && !(data instanceof Buffer)) data = JSON.stringify(data)
        const parent = paths.dirname(path)
        return write(path, data)
    },
    readFile(context, { path, fallback, encoding }) {
        return new Promise((resolve, reject) => {
            path = paths.join(rootPath, path)
            if (fs.existsSync(path)) {
                fs.readFile(path, (err, data) => {
                    if (err) {
                        if (fallback) {
                            if (typeof fallback === 'object' && !(fallback instanceof Buffer)) fallback = JSON.stringify(fallback)
                            resolve(write(path, fallback))
                        }
                        reject(err)
                    } else if (encoding) {
                        if (encoding === 'string') resolve(data.toString())
                        else if (encoding === 'json') resolve(JSON.parse(data.toString()))
                        else if (encoding === 'nbt') resolve(NBT.read(data).root)
                        else if (encoding === 'nbt/compressed') resolve(NBT.read(data, true).root)
                        else if (typeof encoding === 'function') resolve(encoding(data))
                        else {
                            console.warn(`Unsupported encoding ${encoding}!`);
                            resolve(data);
                        }
                    } else resolve(data)
                })
            } else resolve(fallback)
        });
    },
}
