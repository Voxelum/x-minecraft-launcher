import uuid from 'uuid'
import { ActionContext } from 'vuex'
import Vue from 'vue'

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
        async load(context, payload) {
            return context.dispatch('readFolder', { path: 'profiles' }, { root: true })
                .then(files => Promise.all(files.map((id) => {
                    context.commit('add', { id });
                    return context.dispatch(`${id}/load`);
                }).catch(e => undefined)));
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
            } = payload;
            const id = uuid();
            option.java = option.java || context.rootGetters.defaultJava;
            context.commit('add', { id, type });
            context.dispatch(`${id}/edit`, { id, ...option });
        },
        /**
         * 
         * @param {ActionContext} context 
         * @param {string} payload 
         */
        delete(context, payload) {
            context.commit('remove', payload);
            return context.dispatch('delete', `profiles/${payload}`, { root: true });
        },
    },
}
