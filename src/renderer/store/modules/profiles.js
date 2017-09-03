import uuid from 'uuid'
import { GameSetting } from 'ts-minecraft'
import server from './profiles/server'
import modpack from './profiles/modpack'

const PROFILE_NAME = 'profile.json'
const PROFILES_NAEM = 'profiles.json'

function regulize(content) {
    content.resourcepacks = content.resourcepacks || []
    content.resolution = content.resolution || { width: 800, height: 400 }
    content.mods = content.mods || []
    content.vmOptions = content.vmOptions || []
    content.mcOptions = content.mcOptions || []
    if (!content.minecraft) content.minecraft = { name: 'custom' }
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
            return context.dispatch('read', {
                path: `profiles/${id}/${PROFILE_NAME}`,
                fallback: {},
                encoding: 'json',
            }, { root: true })
                .then(regulize)
                .then(profile => context.commit('add', { id, moduleData: profile }))
        },
        load({ dispatch, commit }, payload) {
            return dispatch('readFolder', { path: 'profiles' }, { root: true })
                .then(files => Promise.all(files.map(id => dispatch('loadProfile', id))))
                .then(() => dispatch('read', { path: 'profiles.json', fallback: {}, encoding: 'json' }, { root: true }))
                .then(json => commit('select', json.selected))
        },
        async saveProfile(context, { id }) {
            const profileJson = `profiles/${id}/profile.json`
            const data = await context.dispatch(`${id}/serialize`)
            return context.dispatch('write', { path: profileJson, data }, { root: true })
        },
        save(context, payload) {
            const mutation = payload.mutation
            const object = payload.object
            const path = mutation.split('/')
            if (path.length === 2) {
                const [, action] = path
                if (action === 'select') {
                    return context.dispatch('write', {
                        path: PROFILES_NAEM, data: { selected: context.state.selected },
                    }, { root: true })
                }
                return Promise.resolve();
            } else if (path.length === 3) {
                context.dispatch('saveProfile', { id: path[1] })
            } else if (path.length === 4) {
                const target = path[2]
                return context.dispatch('saveProfile', { id: path[1] })
                    .then(() => context.dispatch(`${path[1]}/${target}/save`, { id: path[1] }))
            }
            return context.dispatch('saveProfile', { id: path[1] })
        },
        create(context, {
            type,
            option = {},
        }) {
            const id = uuid()
            option.java = option.java || context.rootGetters['settings/defaultJava']
            context.commit('add', { id, moduleData: option })
            return context.dispatch('saveProfile', { id })
        },
        delete(context, payload) {
            context.commit('remove', payload)
            return context.dispatch('delete', { path: `profiles/${payload}` }, { root: true })
        },
        select(context, profileId) {
            if (context.getters.selectedKey !== profileId) context.commit('select', profileId)
        },
        createAndSelect(context, payload) {
            return context.dispatch('create', payload).then(id => context.commit('select', id))
        },
    },
}
