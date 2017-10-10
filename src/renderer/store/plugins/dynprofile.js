import uuid from 'uuid'
import { Store } from 'vuex'
import modelServer from '../modules/profiles/server'
import modelModpack from '../modules/profiles/modpack'
import settings from '../modules/profiles/settings'
import mixin from '../helpers/mixin-state'

export default
    /**
     * @param {Store<any>} store
     */
    (store) => {
        store.subscribe((mutation, state) => {
            const type = mutation.type;
            const payload = mutation.payload;
            const rawPaths = type.split('/');
            const paths = rawPaths.slice(0, rawPaths.length - 1)
            const action = rawPaths[rawPaths.length - 1];
            if (type === 'profiles/add') {
                const { id, moduleData } = payload;
                const profileType = payload.type;
                if (!id) {
                    console.error(`Unexpect empty id for adding! @${mutation.type}`)
                    return
                }
                if (!moduleData) {
                    console.error(`Unexpect empty module for adding! @${mutation.type}`)
                    return
                }
                paths.push(id)
                if (!moduleData.namespaced) moduleData.namespaced = true;
                const model = profileType === 'modpack' ? modelModpack : modelServer
                store.registerModule(paths, mixin(model, moduleData));
                for (const subMod of Object.keys(settings)) {
                    const mPath = paths.concat([subMod, 'load']).join('/')
                    store.dispatch(mPath, { id })
                        .then((data) => {
                            store.commit(`profiles/${id}/${subMod}/update$reload`, data)
                        })
                }
            } else if (type === 'profiles/remove') {
                if (!payload) {
                    console.error(`Unexpect empty payload for removal! @${mutation.type}`)
                    return
                }
                paths.push(payload)
                store.unregisterModule(paths);
            }
        })
    }
