import fs from 'fs-extra'
import paths from 'path'
import { ActionContext } from 'vuex'
import { MinecraftFolder } from 'ts-minecraft'
import { remote, ipcRenderer } from 'electron'
import { v4 } from 'uuid'
import makeEnv from './mkenv'

export default {
    searchJava({ dispatch }) {
        return dispatch('query', { service: 'jre', action: 'availbleJre' }, { root: true })
    },
    exit() { ipcRenderer.sendSync('exit') },
    /**
     * 
     * @param {ActionContext} context 
     * @param {} payload 
     * @return {Promise<string[]>}
     */
    openDialog(context, payload) {
        return new Promise((resolve, reject) => {
            remote.dialog.showOpenDialog(
                remote.BrowserWindow.getFocusedWindow(),
                payload,
                (files) => {
                    files = files || [];
                    resolve(files)
                })
        });
    },
    /**
     * @param {ActionContext} context 
     */
    async launch(context) {
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
            gamePath: paths.join(context.state.root, 'profiles', profileId),
            resourcePath: context.state.root,
            javaPath: profile.java,
            minMemory: profile.minMemory || 1024,
            maxMemory: profile.maxMemory || 1024,
            version,
        }

        await makeEnv(context, profileId, new MinecraftFolder(context.state.root),
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
    /**
    * 
    * @param {ActionContext} context 
    * @param {{resolution?:{width:number,height:number,fullscreen?:boolean}, location?:string, theme?:string}} payload 
    */
    updateSetting(context, payload) {
        if (payload.resolution) {
            context.commit('resolution', payload.resolution);
        }
        if (payload.location !== context.state.location || payload.theme !== context.state.theme) {
            ipcRenderer.send('update', payload.location, payload.theme)
        }
    },
    /**
     * 
     * @param {ActionContext} context 
     * @param {{service:string, action:string, payload:any}} payload 
     */
    query(context, payload) {
        const { service, action, $payload } = payload;
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
                payload: $payload,
            })
        });
    },
    /**
     * 
     * @param {ActionContext} context 
     * @param {{path:string}} payload 
     */
    readFolder(context, payload) {
        let { path } = payload;
        path = paths.join(context.state.root, path);
        return fs.ensureDir(path).then(() => fs.readdir(path));
    },
    /**
     * 
     * @param {ActionContext} context 
     * @param {{path:string}} payload 
     */
    delete(context, payload) {
        let { path } = payload;
        path = paths.join(context.state.root, path);
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(path)) resolve()
            else resolve(fs.remove(path))
        });
    },
    /**
      * @param {ActionContext} context 
      * @param {{file:string, toFolder:string, name:string}} payload 
      */
    import(context, payload) {
        const { file, toFolder, name } = payload;
        const to = context.getters.path(toFolder, name || paths.basename(file))
        return fs.copy(file, to)
    },
    /**
     * 
     * @param {ActionContext} context 
     * @param {{ file:string, toFolder:string, name:string, mode:string }} payload 
     */
    export(context, payload) {
        const { file, toFolder, name, mode } = payload;
        const $mode = mode || 'copy';
        const from = context.getters.path(file)
        const to = paths.join(toFolder, name || paths.basename(file))
        if ($mode === 'link') return fs.link(from, to)
        return fs.copy(from, to)
    },
    /**
     * @param {ActionContext} context 
     * @param {{path:string,data:Buffer|string|any}} payload 
     */
    write(context, payload) {
        let { path, data } = payload;
        path = paths.resolve(context.state.root, path)
        if (typeof data === 'object' && !(data instanceof Buffer)) data = JSON.stringify(data)
        const parent = paths.dirname(path)
        return fs.ensureDir(parent).then(() => fs.writeFile(path, data))
    },
    /**
     * 
     * @param {ActionContext} context 
     * @param {{paths:string[]}} payload 
     */
    exist(context, payload) {
        for (const p of payload.paths) if (!fs.existsSync(p)) return false
        return true
    },
    /**
     * 
     * @param {ActionContext} context 
     * @param {{path:string, fallback:string|Buffer, encoding:'string'|'json'|((buf:Buffer)=>any), onread:(path:string)=>void}} payload
     */
    async read(context, payload) {
        let { path, fallback } = payload;
        const { encoding, onread } = payload;
        path = paths.join(context.state.root, path)
        if (!fs.existsSync(path)) {
            if (fallback) return fallback;
            throw new Error(`No such file ${path}`);
        }
        if (onread) onread(path);
        try {
            const data = await fs.readFile(path)
            if (!encoding) return data;
            if (typeof encoding === 'function') return encoding(data);
            switch (encoding) {
                case 'string': return data.toString();
                case 'json': return JSON.parse(data.toString());
                default:
                    console.warn(`Unsupported encoding ${encoding}!`);
                    return data;
            }
        } catch (e) {
            if (fallback) {
                if (typeof fallback === 'object' && !(fallback instanceof Buffer)) fallback = JSON.stringify(fallback);
                await fs.writeFile(path, fallback);
                return fallback;
            }
            throw e;
        }
    },
}
