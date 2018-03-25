import Vue from 'vue'
import { Auth } from 'ts-minecraft'
import { ActionContext } from 'vuex'


export default {
    namespaced: true,
    state: {
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
    modules: {
        mojang: {
            namespaced: true,
            state: {
                api: undefined,
            },
            mutations: {
                api(state, api) { state.api = api; },
            },
            actions: {
                login: (context, option) => Auth.Yggdrasil.login(option, context.state.api),
                refresh: (context, option) => Auth.Yggdrasil.refresh(option, context.state.api),
                validate: (context, option) => Auth.Yggdrasil.validate(option, context.state.api),
                invalide: (context, option) => Auth.Yggdrasil.invalide(option, context.state.api),
                signout: (context, option) => Auth.Yggdrasil.signout(option, context.state.api),
            },
        },
        offline: {
            namespaced: true,
            actions: {
                login: (context, option) => Auth.offline(option.username),
                refresh(option) { },
                validate(option, api) { return true; },
                invalide(option, api) { },
                signout(option, api) { },
            },
        },
    },
    getters: {
        modes: state => Object.keys(state).filter(k => k !== 'mode' && k !== 'auth' && k !== 'history'),
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
            state.mode = mode;
            if (!state.history[mode]) { state.history[mode] = [] }
        },
        setHistory: (state, history) => { state.history = history },
        setCache: (state, cache) => { state.auth = cache },

        history(state, { // record the state history
            auth,
            account,
        }) {
            state.auth = auth;
            if (!state.history[state.mode]) Vue.set(state.history, state.mode, [])
            const his = state.history[state.mode];
            const idx = his.indexOf(account);
            if (idx === -1) {
                his.unshift(account);
            } else {
                const first = his[0];
                Vue.set(his, 0, account);
                Vue.set(his, idx, first);
            }
        },
        modes: (state, modes) => { state.modes = modes },
        clear(state) { state.auth = null; },
    },

    actions: {
        save(context, payload) {
            const { mutation } = payload;
            if (!mutation.endsWith('/history')) return Promise.resolve()
            const data = JSON.stringify(context.state, (key, value) => (key === 'modes' ? undefined : value))
            return context.dispatch('write', { path: 'auth.json', data }, { root: true })
        },
        async load(context) {
            const data = await context.dispatch('read', { path: 'auth.json', fallback: {}, type: 'json' }, { root: true });
            context.commit('mode', data.mode);
            context.commit('setHistory', data.history);
            context.commit('setCache', data.auth);
        },
        /**
         * 
         * @param {ActionContext} context 
         * @param {string} mode 
         */
        selectLoginMode(context, mode) { context.commit('mode', mode); },
        /**
         * Logout and clear current cache.
         */
        logout({ commit }) { commit('clear') },
        /**
         * 
         * @param {ActionContext} context 
         * @param {{mode:string, account:string, password?:string, clientToken?:string}} payload 
         * @return {Promise<Auth>}
         */
        async login(context, payload) {
            if (context.getters.modes.indexOf(payload.mode) === -1) throw new Error(`Cannot find auth named ${payload.mode}`);
            const result = await context.dispatch(`${payload.mode}/login`);
            if (!result) throw new Error(`Cannot auth the ${payload.account}`);
            if (payload.mode !== 'offline' && payload.texture) {
                /**
                 * @type {GameProfile}
                 */
                const gameProfile = await context.dispatch('gameprofile/fetch', { service: payload.mode, uuid: result.selectedProfile.id, cache: true }, { root: true });
                const textures = gameProfile.textures;
                if (textures) {
                    const skin = textures.textures.SKIN;
                    if (skin) {
                        result.skin = {
                            data: skin.data,
                            slim: skin.metadata.model === 'slim',
                        }
                    }
                    if (textures.textures.CAPE) {
                        result.cape = textures.textures.CAPE.data;
                    }
                }
            }
            context.commit('history', {
                auth: result,
                account: payload.account,
            });
            return result;
        },
    },
}
