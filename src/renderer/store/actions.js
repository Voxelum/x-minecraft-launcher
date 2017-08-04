import fs from 'fs-extra'
import paths from 'path'
import { MinecraftFolder } from 'ts-minecraft'
import { remote, ipcRenderer } from 'electron'
import { v4 } from 'uuid'

function write(path, data) {
    console.log(`writeFile to ${path}`)
    return new Promise((resolve, reject) => {
        fs.writeFile(path, data, (err) => {
            if (err) reject(err)
            else resolve()
        })
    });
}

function link(src, dest) {
    return new Promise((resolve, reject) => {
        fs.link(src, dest, (err) => {
            if (err) reject(err)
            else resolve()
        })
    });
}
function symlink(src, dest) {
    return new Promise((resolve, reject) => {
        fs.symlink(src, dest, (err) => {
            if (err) reject(err)
            else resolve()
        })
    });
}

function makeEnv(rootLoc, profileLoc) {
}

export default (rootPath) => {
    return {
        exit() {
            ipcRenderer.sendSync('exit')
        },
        launch(context, payload) {
            console.log('calling launch....')
            const profile = context.getters['profiles/selected'];
            const profileId = context.getters['profiles/selectedKey'];
            const auth = context.state.auth.authInfo;

            if (profile === undefined || profile === null) return Promise.reject('launch.profile.empty')
            if (auth === undefined || auth === null) return Promise.reject('launch.auth.empty');
            // well... these two totally... should not happen; 
            // if it happen... that is a fatal bug or... a troll's work...

            const type = profile.type;
            const version = profile.version;

            const errors = context.getters[`${profileId}/errors`]
            if (errors && errors.length !== 0) return Promise.reject(errors)

            // TODO check the launch condition!
            const option = {
                gamePath: paths.join(rootPath, 'profiles', profileId),
                resourcePath: rootPath,
                javaPath: profile.java,
                minMemory: profile.minMemory || 1024,
                maxMemory: profile.maxMemory || 1024,
                version,
            }
            makeEnv(new MinecraftFolder(rootPath), new MinecraftFolder(option.gamePath))

            if (profile.type === 'server') {
                option.server = { ip: profile.host, port: profile.port };
            }

            return context.dispatch('query', {
                service: 'launcher',
                action: 'launch',
                payload: { auth, option },
            }).then(() => {
                // save all or do other things...
                ipcRenderer.sendSync('park')
            });
        },

        park(context, payload) {

        },
        query(context, { service, action, payload }) {
            return new Promise((resolve, reject) => {
                const id = v4()
                ipcRenderer.send('query', {
                    id,
                    service,
                    action,
                    payload,
                })
                ipcRenderer.once(id, (event, {
                rejected,
                    resolved,
            }) => {
                    if (rejected) reject(rejected)
                    else resolve(resolved)
                })
            });
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
                            else if (encoding === 'json') {
                                try {
                                    resolve(JSON.parse(data.toString()))
                                } catch (e) {
                                    reject(e)
                                }
                            }
                            // else if (encoding === 'nbt') resolve(NBT.read(data).root)
                            // else if (encoding === 'nbt/compressed') resolve(NBT.read(data, true).root)
                            else if (typeof encoding === 'function') {
                                try { resolve(encoding(data)) } catch (e) { reject(e) }
                            } else {
                                console.warn(`Unsupported encoding ${encoding}!`);
                                resolve(data);
                            }
                        } else resolve(data)
                    })
                } else resolve(fallback)
            });
        },
    }
}
