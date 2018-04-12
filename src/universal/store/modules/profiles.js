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
        add(state, payload) {
            /**
             * Prevent the case that hot reload keep the vuex state
             */
            if (state.all.indexOf(payload.id) === -1) {
                state.all.push(payload.id);
            }
        },
        remove(state, id) {
            const idx = state.all.indexOf(id);
            if (idx === -1) return;
            Vue.delete(state.all, idx);
        },
    },
    actions: {
        async load(context, payload) {
            const files = await context.dispatch('readFolder', { path: 'profiles' }, { root: true });
            return Promise.all(files.map(id =>
                context.dispatch('exist', `profiles/${id}/profile.json`, { root: true })
                    .then((exist) => {
                        console.log(id)
                        if (exist) {
                            context.commit('add', { id });
                            return context.dispatch(`${id}/load`);
                        }
                        return Promise.resolve();
                    })
                    .catch((e) => { console.error(e) }),
            ))
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
            option.java = option.java || context.rootGetters['java/default'];
            context.commit('add', { id, type });
            if (type) context.commit(`${id}/${type}/edit`, option);
            context.dispatch(`${id}/edit`, { ...option, type });
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
