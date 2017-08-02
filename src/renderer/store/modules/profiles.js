import uuid from 'uuid'

import mixin from '../mixin-state'
import singleSelect from './models/single-select'
import modelServer from './models/server'
import modelModpack from './models/modpack'

const PROFILE_NAME = 'profile.json'
const PROFILES_NAEM = 'profiles.json'

function regulize(content) {
    content.resourcepacks = content.resourcepacks || []
    content.resolution = content.resolution || [800, 400]
    content.mods = content.mods || []
    content.vmOptions = content.vmOptions || []
    content.mcOptions = content.mcOptions || []
    return content
}

export default {
    namespaced: true,
    state() {
        return singleSelect.state()
    },
    getters: {
        ...singleSelect.getters,
        errors(states, getters) {
            if (getters.selectedKey !== '') {
                const get = getters[`${getters.selectedKey}/errors`]
                if (get) return get
            }
            return []
        },
    },
    mutations: {
        ...singleSelect.mutations,
    },
    actions: {
        load(context, payload) {
            return context.dispatch('readFolder', { path: 'profiles' }, { root: true })
                .then(files =>
                    Promise.all(files.map(file => context.dispatch('readFile', {
                        path: `profiles/${file}/${PROFILE_NAME}`,
                        fallback: {},
                        encoding: 'json',
                    }, { root: true })
                        .then(regulize)
                        .then(profile => [file, profile]))))
                .then((promises) => {
                    for (const [id, profile] of promises) {
                        const model = profile.type === 'modpack' ? modelModpack : modelServer
                        context.commit('add', { id, module: mixin(model, profile) })
                    }
                })
                .then(() => context.dispatch('readFile', { path: 'profiles.json', fallback: {}, encoding: 'json' }, { root: true })
                    .then(json => context.commit('select', json.selected)))
        },
        save(context, payload) {
            const mutation = payload.mutation
            const object = payload.object
            const path = mutation.split('/')
            if (path.length === 2) {
                const [, action] = path
                if (action === 'add') {
                    const targetPath = `profiles/${object.id}/${PROFILE_NAME}`
                    context.dispatch('writeFile', { path: targetPath, data: object.module.state }, { root: true })
                } else if (action === 'select') {
                    context.dispatch('writeFile', {
                        path: PROFILES_NAEM, data: { selected: context.state._selected },
                    }, { root: true })
                }
            } else {
                const [, profileId, action] = path
                const targetPath = `profiles/${profileId}/${PROFILE_NAME}`
                context.dispatch(`${profileId}/save`)
                    .then(data => context.dispatch('writeFile', { path: targetPath, data }, { root: true }))
            }
        },
        create(context, {
            type,
            option,
        }) {
            const id = uuid()
            console.log(`create ${id}: ${type} with`)
            if (type === 'server') {
                context.commit('add', { id, module: mixin(modelServer, option) })
            } else if (type === 'modpack') {
                context.commit('add', { id, module: mixin(modelModpack, option) })
            }
            return id;
        },
        delete(context, payload) {
            context.commit('remove', payload)
            return context.dispatch('deleteFolder', { path: `profiles/${payload}` }, { root: true })
        },
        select(context, profileId) {
            if (context.getters.selectedKey !== profileId) context.commit('select', profileId)
        },
        createAndSelect(context, payload) {
            return context.dispatch('create', payload).then(id => context.commit('select', id))
        },
    },
}
