import uuid from 'uuid'
import { ServerInfo } from 'ts-minecraft'

import mixin from '../mixin-state'
import singleSelect from './models/single-select'
import modelServer from './models/server'
import modelModpack from './models/modpack'

const PROFILE_NAME = 'profile.json'

function parseProfile(content) {
    return {
        id: content.id,
        type: content.type,
        name: content.name,
        version: content.version,
        resourcepacks: content.resourcepacks || [],
        mods: content.mods || [],
        resolution: content.resolution || [800, 400],
        java: content.java,
        vmOptions: content.vmOptions,
        mcOptions: content.mcOptions,
    }
}

export default {
    namespaced: true,
    state() {
        return singleSelect.state()
    },
    getters: {
        ...singleSelect.getters,
    },
    mutations: {
        ...singleSelect.mutations,
    },
    actions: {
        load(context, payload) {
            return Promise.all([
                context.dispatch('readFolder', { path: 'profiles' }, { root: true }).then(files =>
                    Promise.all(files.map(file => context.dispatch('readFile', {
                        path: `profiles/${file}/${PROFILE_NAME}`,
                        fallback: {},
                        encoding: 'json',
                    }, { root: true }).then(object => parseProfile(object))))),
                context.dispatch('readFile', {
                    path: 'servers.dat',
                    fallback: [],
                    encoding: data => ServerInfo.readFromNBT(data),
                }, { root: true })]).then(promise => promise[0].concat(promise[1]))
        },
        save(context, payload) {
            console.log('save profile')
            console.log(payload)
        },
        create(context, {
            type,
            option,
        }) {
            const id = uuid()
            if (type === 'server') {
                context.commit('add', { id, module: mixin(modelServer, option) })
            } else if (type === 'modpack') {
                option.name = 'New Modpack'
                option.author = context.rootGetters['auth/info'].selectedProfile.name
                option.description = 'no description yet!'
                context.commit('add', { id, module: mixin(modelModpack, option) })
            }
            return id;
        },
    },
}
