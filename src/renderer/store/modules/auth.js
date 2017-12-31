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
    },
    getters: {
        modes: state => state.modes,
        mode: state => state.mode,
        username: state => (state.auth.selectedProfile ? state.auth.selectedProfile.name : ''),
        id: state => (state.auth.id ? state.auth.id : ''),
        skin: state => (state.auth.skin ? state.auth.skin : ''),
        cape: state => (state.auth.cape ? state.auth.cape : ''),
        history: state => state.history[state.mode],
        logined: state => typeof state.auth === 'object' && Object.keys(state.auth).length !== 0,
    },
    mutations: {
        mode(state, mode) {
            if (state.modes.indexOf(mode) !== -1) {
                state.mode = mode;
                if (!state.history[mode]) { state.history[mode] = [] }
            }
        },
        login(state, {
            auth,
            account,
        }) {
            state.auth = Object.assign({}, auth);
            if (!state.history[state.mode]) Vue.set(state.history, state.mode, [])
            const his = state.history[state.mode];
            const idx = his.indexOf(account);
            if (idx === -1) his.push(account)
            else if (idx === 0) return;
            const first = his[0];
            Vue.set(his, 0, account);
            Vue.set(his, idx, first);
        },
        setAuth(state, auth) {
            state.auth = auth;
        },
        setHistory(state, history) {
            Object.keys(history).forEach((k) => {
                state.history[k] = history[k];
            })
        },
        modes: (state, modes) => { state.modes = modes },
        clear(state) {
            state.auth = undefined;
        },
    },
    actions: {
        save(context) {
            const data = JSON.stringify(context.state, (key, value) => (key === 'modes' ? undefined : value))
            return context.dispatch('write', { path: 'auth.json', data }, { root: true })
        },
        validate(context, auth) {
            if (typeof auth.accessToken !== 'string' ||
                typeof auth.clientToken !== 'string') return false;
            return context.dispatch('query', {
                service: 'auth',
                action: 'validate',
                payload: auth,
            }, { root: true });
        },
        async load(context, payload) {
            const data = await context.dispatch('read', { path: 'auth.json', fallback: {}, type: 'json' }, { root: true });
            context.commit('modes', await context.dispatch('query', { service: 'auth', action: 'modes' }, { root: true }));
            if (typeof data.mode === 'string') context.commit('mode', data.mode);
            if (data.mode !== 'offline') {
                if (await context.dispatch('validate', data.auth)) {
                    context.commit('setAuth', data.auth);
                }
            } else { context.commit('setAuth', data.auth); }
            if (typeof data.history === 'object') {
                context.commit('setHistory', data.history);
            }
        },
        /**
         * 
         * @param {ActionContext} context 
         * @param {string} mode 
         */
        selectMode(context, mode) {
            context.commit('mode', mode);
            return context.dispatch('save');
        },
        /**
         * Logout and clear current cache.
         */
        logout({ commit, dispatch }) {
            commit('clear');
            return dispatch('save');
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
                const textures = (await context.dispatch('query', {
                    service: 'profile',
                    action: 'fetch',
                    payload: { service: 'mojang', uuid: result.selectedProfile.id, cache: true },
                }, { root: true })).textures;
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
            } catch (e) {
                console.warn(e);
            }
            context.commit('login', {
                auth: result,
                account: payload.account,
            });
            await context.dispatch('save')
            return result;
        },
    },
}
