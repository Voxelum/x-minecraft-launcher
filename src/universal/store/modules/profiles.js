import uuid from 'uuid'
import { ActionContext } from 'vuex'
import Vue from 'vue'
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
    return content
}

export default {
    namespaced: true,
    state: () => ({
        /**
         * @type {Profile[]}
         */
        all: [],
    }),
    getters: {
        profiles: state => state.all.map(mName => state[mName]),
        get: state => id => state[id],
        ids: state => state.all,
    },
    mutations: {
        add(state, payload) { state.all.push(payload.id) },
        remove(state, id) {
            const idx = state.all.indexOf(id);
            if (idx === -1) return;
            Vue.delete(state.all, idx);
        },
    },
    actions: {
        load(context, payload) {
            return context.dispatch('readFolder', { path: 'profiles' }, { root: true })
                .then(files => Promise.all(files.map(id => context.dispatch('read', {
                    path: `profiles/${id}/${PROFILE_NAME}`,
                    fallback: {},
                    type: 'json',
                }, { root: true })
                    .then(regulize)
                    .then(profile => context.commit('add', { id, type: profile.type, moduleData: profile }))
                    .catch(e => undefined),
                )))
        },
        async saveProfile(context, { id }) {
            const profileJson = `profiles/${id}/profile.json`
            const data = await context.dispatch(`${id}/serialize`)
            return context.dispatch('write', { path: profileJson, data }, { root: true })
        },
        /**
         * @param {ActionContext} context 
         * @param {{mutation:string, object:any}} payload 
         */
        save(context, payload) {
            const { mutation, object } = payload
            const path = mutation.split('/')
            if (path.length === 2) {
                return Promise.resolve();
            } else if (path.length === 3) { // only profile
                return Promise.all([
                    context.dispatch('saveProfile', { id: path[1] }),
                    context.dispatch(`${path[1]}/save`, { id: path[1], mutation: path[2] }),
                ])
            }
            return context.dispatch('saveProfile', { id: path[1] })
        },
        /**
         * @param {ActionContext} context 
         * @param {CreateOption} payload 
         * @return {Promise<string>}
         */
        create(context, payload) {
            const {
                type,
                option = {},
            } = payload
            const id = uuid()
            option.java = option.java || context.rootGetters.defaultJava
            context.commit('add', { id, type, moduleData: option })
            return context.dispatch('saveProfile', { id })
        },
        /**
         * 
         * @param {ActionContext} context 
         * @param {string} payload 
         */
        delete(context, payload) {
            context.commit('remove', payload)
            return context.dispatch('delete', `profiles/${payload}`, { root: true })
        },
    },
}
