
import { ActionContext } from 'vuex'
import { MinecraftFolder } from 'ts-minecraft'
import { remote, ipcRenderer } from 'electron'
import paths from 'path'
import { v4 } from 'uuid'
import make from './helpers/mkenv'

export default {
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
       * 
       * @param {ActionContext} context 
       * @param {{resolution?:{width:number,height:number,fullscreen?:boolean}, location?:string, theme?:string}} payload 
       */
    updateSetting(context, payload) {
        if (payload.resolution) {
            context.commit('resolution', payload.resolution);
        }
        if (payload.location !== context.state.root ||
            payload.theme !== context.state.theme) {
            ipcRenderer.send('update', payload.location, payload.theme)
        }
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
        // if it happen... that is a fatal bug...

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

        // make the launch environment
        await make(context, profileId, new MinecraftFolder(context.state.root),
            new MinecraftFolder(option.gamePath))

        if (profile.type === 'server') {
            option.server = { ip: profile.host, port: profile.port };
        }

        return context.dispatch('query', {
            service: 'launch',
            action: 'launch',
            payload: { auth, option },
        }).then(() => {
            // save all or do other things...
            ipcRenderer.sendSync('park', true)
        }).catch((e) => {
            if (e.message.startsWith('Cannot find version ') || e.message.startsWith('No version file for ')) {
                throw new Error('missing.version')
            } else if (e.message === 'Missing library') {
                throw new Error('missing.libraries')
            } else if (e.message === 'Missing asset!') {
                throw new Error('missing.assets')
            } else if (e.message === 'Missing mainClass' || e.message === 'Missing minecraftArguments') {
                throw new Error('illegal.version.json')
            }
            throw e;
        })
    },
}
