import fs from 'fs-extra'
import paths from 'path'
import { remote } from 'electron'
import launcher from '../launcher'

const rootPath = paths.join(remote.app.getPath('appData'), '.launcher')
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
    launch(context, payload) {
        console.log('calling launch....')
        const profile = context.getters['profiles/selected'];
        const profileId = context.getters['profiles/selectedKey'];
        const auth = context.state.auth.authInfo;

        const type = profile.type;
        const version = profile.version;
        const option = {
            gamePath: paths.join(rootPath, 'profiles', profileId),
            resourcePath: rootPath,
            javaPath: profile.java,
            minMemory: profile.minMemory || 1024,
            maxMemory: profile.maxMemory || 1024,
            version,
        }
        if (profile.type === 'server') {
            option.server = { ip: profile.host, port: profile.port };
        }

        return context.dispatch('query', {
            service: 'launcher',
            action: 'launch',
            payload: { auth, option },
        });
        // return ''
    },
    park(context, payload) {
        
    },
    query(context, payload) {
        return launcher.query(payload.service, payload.action, payload.payload)
    },
    readFolder(context, { path }) {
        path = paths.join(rootPath, path);
        console.log(`Read folder ${path}`)
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(path)) resolve(fs.ensureDir(path))
            else resolve()
        }).then(() => new Promise((resolve, reject) => {
            fs.readdir(path, (err, files) => {
                if (err) reject(err)
                else resolve(files)
            })
        }));
    },
    deleteFolder(context, { path }) {
        path = paths.join(rootPath, path);
        console.log(`Delete ${path}`);
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(path)) resolve()
            else resolve(fs.remove(path))
        });
    },
    writeFile(context, { path, data }) {
        path = paths.resolve(rootPath, path)
        if (typeof data === 'object' && !(data instanceof Buffer)) data = JSON.stringify(data)
        const parent = paths.dirname(path)
        return fs.ensureDir(parent).then(() => write(path, data))
    },
    existFiles(context, payload) {
        for (const p of payload.paths) if (!fs.existsSync(p)) return false
        return true
    },
    readFile(context, { path, fallback, encoding, onread }) {
        return new Promise((resolve, reject) => {
            path = paths.join(rootPath, path)
            if (fs.existsSync(path)) {
                if (onread) onread(path)
                fs.readFile(path, (err, data) => {
                    console.log(`read file ${path} done`)
                    if (err) {
                        if (fallback) {
                            if (typeof fallback === 'object' && !(fallback instanceof Buffer)) fallback = JSON.stringify(fallback)
                            resolve(write(path, fallback))
                        }
                        reject(err)
                    } else if (encoding) {
                        if (encoding === 'string') resolve(data.toString())
                        else if (encoding === 'json') resolve(JSON.parse(data.toString()))
                        // else if (encoding === 'nbt') resolve(NBT.read(data).root)
                        // else if (encoding === 'nbt/compressed') resolve(NBT.read(data, true).root)
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
