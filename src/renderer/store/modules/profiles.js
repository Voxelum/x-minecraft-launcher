import uuid from 'uuid'
import { GameSetting } from 'ts-minecraft'

import mixin from '../mixin-state'
import singleSelect from './models/single-select'
import modelServer from './models/server'
import modelModpack from './models/modpack'

const PROFILE_NAME = 'profile.json'
const PROFILES_NAEM = 'profiles.json'

function regulize(content) {
    content.resourcepacks = content.resourcepacks || []
    content.resolution = content.resolution || { width: 800, height: 400 }
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
        async load(context, payload) {
            return context.dispatch('readFolder', { path: 'profiles' }, { root: true })
                .then(files =>
                    Promise.all(files.map(file => context.dispatch('readFile', {
                        path: `profiles/${file}/${PROFILE_NAME}`,
                        fallback: {},
                        encoding: 'json',
                    }, { root: true })
                        .then(regulize)
                        .then(profile => context.dispatch('readFile', {
                            path: `profiles/${file}/options.txt`,
                            fallback: context.rootState.settings.mcsettings.midum,
                            encoding: 'string',
                        }, { root: true })
                            .then(setting => [file, { ...profile, setting }])))))
                .then((promises) => {
                    for (const [id, profile] of promises) {
                        const model = profile.type === 'modpack' ? modelModpack : modelServer
                        context.commit('add', { id, module: mixin(model, profile) })
                    }
                })
                .then(() => context.dispatch('readFile', { path: 'profiles.json', fallback: {}, encoding: 'json' }, { root: true })
                    .then(json => context.commit('select', json.selected)))
        },
        async save(context, payload) {
            const mutation = payload.mutation
            const object = payload.object
            const path = mutation.split('/')
            if (path.length === 2) {
                const [, action] = path
                if (action === 'add') {
                    const targetPath = `profiles/${object.id}/${PROFILE_NAME}`
                    const settingTxt = `profiles/${object.id}/options.txt`
                    return Promise.all(
                        context.dispatch('writeFile', { path: targetPath, data: JSON.stringify(object.module.state, (key, value) => (key === 'setting' ? undefined : value)) }, { root: true }),
                        context.dispatch('writeFile', { path: settingTxt, data: GameSetting.writeToString(object.module.state.setting) }, { root: true }),
                    )
                } else if (action === 'select') {
                    return context.dispatch('writeFile', {
                        path: PROFILES_NAEM, data: { selected: context.state._selected },
                    }, { root: true })
                }
                return Promise.resolve();
            }
            const [, profileId, action] = path
            const profileJson = `profiles/${profileId}/${PROFILE_NAME}`
            const settingTxt = `profiles/${profileId}/options.txt`
            const data = await context.dispatch(`${profileId}/save`)
            const setting = data.setting;
            data.setting = undefined;
            console.log('save setting:')
            console.log(GameSetting.writeToString(setting))
            return Promise.all(
                context.dispatch('writeFile', { path: profileJson, data }, { root: true }),
                context.dispatch('writeFile', { path: settingTxt, data: GameSetting.writeToString(setting) }, { root: true }),
            )
        },
        create(context, {
            type,
            option,
        }) {
            const id = uuid()
            if (!option.java) {
                if (context.rootState.settings.javas.length !== 0) {
                    option.java = context.rootState.settings.javas[0]
                }
            }
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
