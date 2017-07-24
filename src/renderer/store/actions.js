import fs from 'fs'
import paths from 'path'
import mkdirp from 'mkdirp'
import { remote } from 'electron'
import { NBT } from 'ts-minecraft'
import launcher from '../launcher'

const rootPath = paths.join(remote.app.getPath('appData'), '.launcher')
export default {
    // query: launcher.query,
    query(context, payload) {
        return launcher.query(payload.service, payload.action, payload.payload)
    },
    // loadAll(context, payload) {
    //     const keys = Object.keys(context.rootState)
    //     for (const key of keys) {
    //         const mod = context.rootState[key]
    //         if (mod.load) {

    //         }
    //     }
    // },
    readFolder(context, { path }) {
        path = paths.join(rootPath, path);
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
        return new Promise((resolve, reject) => {
            path = paths.resolve(rootPath, path)
            fs.writeFile(path, data, (err) => {
                if (err) reject(err)
                else resolve()
            })
        });
    },
    readFile(context, { path, fallback, encoding, onread }) {
        return new Promise((resolve, reject) => {
            path = paths.join(rootPath, path)
            if (fs.existsSync(path)) {
                if (onread) onread(path)
                fs.readFile(path, (err, data) => {
                    if (err) reject(err)
                    else if (encoding) {
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
