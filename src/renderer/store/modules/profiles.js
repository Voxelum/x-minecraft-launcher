import uuid from 'uuid'
import { GameSetting } from 'ts-minecraft'

import mixin from '../mixin-state'
import modelServer from './profiles/server'
import modelModpack from './profiles/modpack'

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
        return {
            all: [],
            selected: '',
        }
    },
    getters: {
        selected: state => state[state.selected],
        allStates: state => state.all.map(mName => state[mName]),
        getByKey: state => id => state[id],
        selectedKey: state => state.selected,
        allKeys: state => state.all,
        errors(states, getters) {
            if (getters.selectedKey !== '') {
                const get = getters[`${getters.selectedKey}/errors`]
                if (get) return get
            }
            return []
        },
    },
    mutations: {
        unselect(state) {
            state.selected = ''
        },
        select(state, moduleID) {
            const idx = state.all.indexOf(moduleID);
            if (idx !== -1) state.selected = moduleID;
        },
        add(state, payload) {
            state.all.push(payload.id)
        },
        remove(state, id) {
            if (state.all.indexOf(id) !== -1) {
                if (state.selected === id) {
                    state.selected = state.all[0]
                }
                state.all = state.all.filter(v => v !== id)
            }
        },
    },
    actions: {
        async loadOptions(context, payload) {

        },
        loadOptifine() { return {} },
        loadForge() { return undefined },
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
                            fallback: context.rootState.settings.templates.minecraft.midum,
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
            // const mutation = payload.mutation
            // const object = payload.object
            // const path = mutation.split('/')
            // if (path.length === 2) {
            //     const [, action] = path
            //     if (action === 'select') {
            //         return context.dispatch('writeFile', {
            //             path: PROFILES_NAEM, data: { selected: context.state.selected },
            //         }, { root: true })
            //     }
            //     return Promise.resolve();
            // }
            // const [, profileId, action] = path
            // return context.dispatch(`${profileId}/save`)
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
                context.commit('add', { id, module: modelServer })
                context.commit(`${id}/putAll`, option)
            } else if (type === 'modpack') {
                context.commit('add', { id, module: modelModpack })
                context.commit(`${id}/putAll`, option)
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
