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
        loadProfile(context, id) {
            return context.dispatch('readFile', {
                path: `profiles/${id}/${PROFILE_NAME}`,
                fallback: {},
                encoding: 'json',
            }, { root: true })
                .then(regulize)
                .then(profile => Object.create({ id, profile }))
        },
        loadOptions(context, { id, profile }) {
            return context.dispatch('readFile', {
                path: `profiles/${id}/options.txt`,
                fallback: context.rootGetters['settings/defaultOptions'],
                encoding: 'string',
            }, { root: true })
                .then((option) => {
                    profile.minecraft = option;
                    return { id, profile }
                })
        },
        loadOptifine(context, { id, profile }) { return { id, profile } },
        loadForge(context, { id, profile }) { return { id, profile } },
        load({ dispatch, commit }, payload) {
            return dispatch('readFolder', { path: 'profiles' }, { root: true })
                .then(files => Promise.all(files.map(
                    id => dispatch('loadProfile', id)
                        .then(pass => dispatch('loadOptions', pass))
                        .then(pass => dispatch('loadForge', pass))
                        .then(pass => dispatch('loadOptifine', pass)))))
                .then((list) => {
                    list.forEach(({ id, profile }) => {
                        const model = profile.type === 'modpack' ? modelModpack : modelServer
                        commit('add', { id, module: mixin(model, profile) })
                    })
                })
                .then(() => dispatch('readFile', { path: 'profiles.json', fallback: {}, encoding: 'json' }, { root: true })
                    .then(json => commit('select', json.selected)))
        },
        async saveOptions(context, { id, settings }) {
            const minecraft = settings.minecraft;
            const path = `profiles/${id}/options.txt`
            return context.dispatch('writeFile', {
                path: `profiles/${id}/options.txt`,
                data: GameSetting.writeToString(minecraft.instance),
            }, { root: true })
        },
        saveForge(context, { id, settings }) {
            if (!settings.forge) return Promise.resolve()

            return Promise.resolve()
        },
        saveOptifine(context, { id, settings }) {
            if (!settings.optifine) return Promise.resolve()

            return Promise.resolve()
        },
        async saveProfile(context, { id }) {
            const profileJson = `profiles/${id}/profile.json`
            const data = await context.dispatch(`${id}/serialize`)
            const settings = {
                minecraft: data.minecraft,
                forge: data.forge,
                liteloader: data.liteloader,
                optifine: data.optifine,
            };
            data.minecraft = undefined;
            data.forge = undefined;
            data.liteloader = undefined;
            data.optifine = undefined;
            return context.dispatch('writeFile', { path: profileJson, data }, { root: true })
                .then(() => context.dispatch('saveOptions', { id, settings }))
                .then(() => context.dispatch('saveOptifine', { id, settings }))
                .then(() => context.dispatch('saveForge', { id, settings }))
        },
        async save(context, payload) {
            const mutation = payload.mutation
            const object = payload.object
            const path = mutation.split('/')
            if (path.length === 2) {
                const [, action] = path
                if (action === 'select') {
                    return context.dispatch('writeFile', {
                        path: PROFILES_NAEM, data: { selected: context.state.selected },
                    }, { root: true })
                }
                return Promise.resolve();
            }
            return context.dispatch('saveProfile', { id: path[1] })
        },
        create(context, {
            type,
            option,
        }) {
            const id = uuid()
            option.java = option.java || context.rootGetters['settings/defaultJava']
            const module = type === 'server' ? modelServer : type === 'modpack' ? modelModpack : undefined;
            context.commit('add', { id, module })
            context.commit(`${id}/putAll`, option)
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
