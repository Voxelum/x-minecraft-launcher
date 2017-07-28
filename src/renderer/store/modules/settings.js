
import paths from 'path'
import { remote } from 'electron'


export default {
    state() {
        return {
            rootPath: paths.join(remote.app.getPath('appData'), '.launcher'),
            default: 'semantic',
            theme: 'semantic',
            themes: [], // todo... I think we need a more generic way... 
        }
    },
    mutations: {

    },
    getters: {},
    actions: {
        load(context, payload) {
            context.dispatch('readFile', { path: 'setting.json' }, { root: true })
        },
    },
}
