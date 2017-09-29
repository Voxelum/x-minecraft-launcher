import Vue from 'vue'
import { Auth, GameProfile } from 'ts-minecraft'
import { ActionContext } from 'vuex'

export default {
    namespaced: true,
    state: {
        modes: ['mojang', 'offline'],
        mode: 'mojang',
        /**
         * @type {{[mode:string]: string[]}}
         */
        history: {},
        /**
         * @type {Auth}
         */
        auth: {}, // cached
        cache: {
            skin: { data: undefined, slim: false },
            cape: undefined,
        },
    },
    getters: {
        modes: state => state.modes,
        mode: state => state.mode,
        username: state => (state.auth.selectedProfile ? state.auth.selectedProfile.name : ''),
        id: state => (state.auth.id ? state.auth.id : ''),
        skin: state => (state.auth.skin ? state.auth.skin : ''),
        cape: state => (state.auth.cape ? state.auth.cape : ''),
        history: state => state.history[state.mode],
    },
    mutations: {
        mode(state, mode) {
            if (state.modes.indexOf(mode) !== -1) state.mode = mode
        },
        history(state, { // record the state history
            auth,
            account,
        }) {
            state.auth = auth;
            if (!state.history[state.mode]) Vue.set(state.history, state.mode, [])
            const his = state.history[state.mode];
            const idx = his.indexOf(account);
            if (idx === -1) his.push(account)
            else if (idx === 0) return;
            const first = his[0];
            Vue.set(his, 0, account);
            Vue.set(his, idx, first);
        },
        modes: (state, modes) => { state.modes = modes },
        clear(state) {
            state.auth = undefined;
            state.cache = {
                skin: { data: undefined, slim: false },
                cape: undefined,
            };
        },
    },
    actions: {
        save(context, payload) {
            const { mutation } = payload;
            if (!mutation.endsWith('/history')) return Promise.resolve()
            const data = JSON.stringify(context.state, (key, value) => (key === 'modes' ? undefined : value))
            return context.dispatch('write', { path: 'auth.json', data }, { root: true })
        },
        async load(context, payload) {
            const data = await context.dispatch('read', { path: 'auth.json', fallback: {}, encoding: 'json' }, { root: true });
            context.commit('modes', await context.dispatch('query', { service: 'auth', action: 'modes' }, { root: true }));
            return data;
        },
        /**
         * 
         * @param {ActionContext} context 
         * @param {string} mode 
         */
        selectMode(context, mode) {
            context.commit('mode', mode);
        },
        /**
         * Logout and clear current cache.
         */
        async logout({ commit }) {
            commit('clear')
        },
        /**
         * 
         * @param {ActionContext} context 
         * @param {{mode:string, account:string, password?:string, clientToken?:string}} payload 
         * @return {Promise<Auth>}
         */
        async login(context, payload) {
            const result = await context.dispatch('query', { service: 'auth', action: 'login', payload }, { root: true })

            try {
                /**
                 * @type {GameProfile.Textures}
                 */
                const textures = await context.dispatch('query', {
                    service: 'profile',
                    action: 'fetch',
                    payload: { service: 'mojang', uuid: result.selectedProfile.id, cache: true },
                }, { root: true }).textures;
                const skin = textures.textures.SKIN
                if (skin) {
                    result.skin = {
                        data: skin.data,
                        slim: skin.metadata.model === 'slim',
                    }
                }
                if (textures.textures.CAPE) {
                    result.cape = textures.textures.CAPE.data;
                }
            } catch (e) { }
            context.commit('history', {
                auth: result,
                account: payload.account,
            });
            return result;
        },
    },
}
