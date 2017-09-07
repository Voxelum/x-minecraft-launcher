import fs from 'fs-extra'
import paths from 'path'
import { MinecraftFolder } from 'ts-minecraft'
import { remote, ipcRenderer } from 'electron'
import { v4 } from 'uuid'
import makeEnv from './mkenv'

function $write(path, data) {
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

export default (rootPath) => {
    return {
        exit() {
            ipcRenderer.sendSync('exit')
        },
        async launch(context, payload) {
            // console.log('calling launch....')
            const profile = context.getters['profiles/selected'];
            const profileId = context.getters['profiles/selectedKey'];
            const auth = context.state.auth.auth;

            if (profile === undefined || profile === null) return Promise.reject('launch.profile.empty')
            if (auth === undefined || auth === null) return Promise.reject('launch.auth.empty');
            // well... these two totally... should not happen; 
            // if it happen... that is a fatal bug or... a troll's work...

            const type = profile.type;
            const version = profile.minecraft.version;
            const errors = context.getters[`profiles/${profileId}/errors`]
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

            await makeEnv(context, profileId, new MinecraftFolder(rootPath),
                new MinecraftFolder(option.gamePath))

            if (profile.type === 'server') {
                option.server = { ip: profile.host, port: profile.port };
            }

            return context.dispatch('query', {
                service: 'launcher',
                action: 'launch',
                payload: { auth, option },
            }).then(() => {
                // save all or do other things...
                ipcRenderer.sendSync('park', true)
            }).catch((err) => {
                
            });
        },
        query(context, { service, action, payload }) {
            return new Promise((resolve, reject) => {
                const id = v4()
                ipcRenderer.once(id,
                    (event, { rejected, resolved }) => {
                        // console.log(`finish ${id}`)
                        if (rejected) reject(rejected)
                        else resolve(resolved)
                    })
                ipcRenderer.send('query', {
                    id,
                    service,
                    action,
                    payload,
                })
            });
        },
        readFolder(context, { path }) {
            path = paths.join(rootPath, path);
            // console.log(`Read folder ${path}`)
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
        delete(context, { path }) {
            path = paths.join(rootPath, path);
            // console.log(`Delete ${path}`);
            return new Promise((resolve, reject) => {
                if (!fs.existsSync(path)) resolve()
                else resolve(fs.remove(path))
            });
        },
        import(context, { file, toFolder, name }) {
            const to = context.getters.path(toFolder, name || paths.basename(file))
            return fs.copy(file, to)
        },
        export(context, { file, toFolder, name, mode }) {
            const $mode = mode || 'copy';
            const from = context.getters.path(file)
            const to = paths.join(toFolder, name || paths.basename(file))
            if ($mode === 'link') return link(from, to)
            return fs.copy(from, to)
        },
        write(context, { path, data }) {
            path = paths.resolve(rootPath, path)
            if (typeof data === 'object' && !(data instanceof Buffer)) data = JSON.stringify(data)
            const parent = paths.dirname(path)
            return fs.ensureDir(parent).then(() => $write(path, data))
        },
        exist(context, payload) {
            for (const p of payload.paths) if (!fs.existsSync(p)) return false
            return true
        },
        read(context, { path, fallback, encoding, onread }) {
            return new Promise((resolve, reject) => {
                path = paths.join(rootPath, path)
                if (fs.existsSync(path)) {
                    if (onread) onread(path)
                    fs.readFile(path, (err, data) => {
                        // console.log(`read file ${path} done`)
                        if (err) {
                            if (fallback) {
                                if (typeof fallback === 'object' && !(fallback instanceof Buffer)) fallback = JSON.stringify(fallback)
                                resolve($write(path, fallback))
                            } else reject(err)
                        } else if (encoding) {
                            if (encoding === 'string') resolve(data.toString())
                            else if (encoding === 'json') {
                                try {
                                    resolve(JSON.parse(data.toString()))
                                } catch (e) {
                                    if (fallback) {
                                        if (typeof fallback === 'object' && !(fallback instanceof Buffer)) fallback = JSON.stringify(fallback)
                                        resolve($write(path, fallback))
                                    } else reject(e)
                                }
                            }
                            // else if (encoding === 'nbt') resolve(NBT.read(data).root)
                            // else if (encoding === 'nbt/compressed') resolve(NBT.read(data, true).root)
                            else if (typeof encoding === 'function') {
                                try { resolve(encoding(data)) } catch (e) {
                                    if (fallback) {
                                        if (typeof fallback === 'object' && !(fallback instanceof Buffer)) fallback = JSON.stringify(fallback)
                                        resolve($write(path, fallback))
                                    } else reject(e)
                                }
                            } else {
                                console.warn(`Unsupported encoding ${encoding}!`);
                                resolve(data);
                            }
                        } else resolve(data)
                    })
                } else {
                    console.log(`File ${path} not exist! return fallback`)
                    resolve(fallback)
                }
            });
        },
    }
}
