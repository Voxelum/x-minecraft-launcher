import Vue from 'vue'
import { Auth, MojangAccount, MojangService, GameProfile } from 'ts-minecraft'
import { ActionContext } from 'vuex'
import { v4 } from 'uuid'


export default {
    namespaced: true,
    state: {
        mode: 'mojang',
        /**
         * @type {{[mode:string]: string[]}}
         */
        history: {},
        clientToken: '',
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
                login: (context, option) => Auth.Yggdrasil.login(option),
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
        modes: state => Object.keys(state).filter(k => k !== 'mode' && k !== 'auth' && k !== 'history' && k !== 'clientToken'),
        mode: state => state.mode,
        username: state => (state.auth.selectedProfile ? state.auth.selectedProfile.name : ''),
        id: state => (state.auth.id ? state.auth.id : ''),
        skin: state => (state.auth.skin ? state.auth.skin : ''),
        cape: state => (state.auth.cape ? state.auth.cape : ''),
        history: state => state.history[state.mode],
        logined: state => typeof state.auth === 'object' && Object.keys(state.auth).length !== 0,
        info: state => (state.auth.info ? state.auth.info : {}),
    },
    mutations: {
        mode(state, mode) {
            state.mode = mode;
            if (!state.history[mode]) { state.history[mode] = [] }
        },
        setHistory: (state, history) => { state.history = history },
        setCache: (state, cache) => { state.auth = cache },
        setClientToken: (state, clientToken) => { state.clientToken = clientToken },

        login(state, { // record the state history
            auth,
            account,
        }) {
            state.auth = Object.assign({}, auth);
            if (!state.history[state.mode]) Vue.set(state.history, state.mode, [])
            if (account) {
                const his = state.history[state.mode];
                const idx = his.indexOf(account);
                if (idx === -1) {
                    his.unshift(account);
                } else {
                    const first = his[0];
                    Vue.set(his, 0, account);
                    Vue.set(his, idx, first);
                }
            }
        },
        modes: (state, modes) => { state.modes = modes },
        clear(state) { state.auth = {}; },
    },

    actions: {
        save(context, payload) {
            const { mutation } = payload;
            const data = JSON.stringify(context.state, (key, value) => (key === 'modes' ? undefined : value), undefined, 4);
            return context.dispatch('write', { path: 'auth.json', data }, { root: true })
        },
        async load(context) {
            const data = await context.dispatch('read', { path: 'auth.json', fallback: {}, type: 'json' }, { root: true });
            context.commit('mode', data.mode);
            context.commit('setHistory', data.history);
            context.commit('setCache', data.auth);
            context.commit('setClientToken', data.clientToken || v4());
            await context.dispatch('refresh')
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
        async logout(context) {
            const mode = context.state.mode;
            if (context.getters.modes.indexOf(mode) === -1) {
                throw new Error(`Cannot find auth named ${mode}`);
            }
            if (context.getters.logined) {
                await context.dispatch(`${mode}/invalide`, {
                    clientToken: context.state.clientToken,
                    accessToken: context.state.auth.accessToken,
                });
            }
            context.commit('clear')
        },
        /**
         * Refresh the current user login status
         */
        async refresh(context) {
            const mode = context.state.mode;
            if (context.getters.modes.indexOf(mode) === -1) {
                throw new Error(`Cannot find auth named ${mode}`);
            }
            if (!context.getters.logined) return;
            const validate = await context.dispatch(`${mode}/validate`, {
                clientToken: context.state.clientToken,
                accessToken: context.state.auth.accessToken,
            });
            if (!validate) {
                context.commit('clear');
                return;
            }
            try {
                const auth = await context.dispatch(`${mode}/refresh`, {
                    clientToken: context.state.clientToken,
                    accessToken: context.state.auth.accessToken,
                });
                console.log('refrehsed!');
                const gameProfile = await context.dispatch('gameprofile/fetch', { service: mode, uuid: auth.selectedProfile.id, cache: true }, { root: true });
                const textures = gameProfile.textures;
                if (textures) {
                    const skin = textures.textures.skin;
                    if (skin) {
                        auth.skin = {
                            data: skin.data,
                            slim: skin.metadata ? skin.metadata.model === 'slim' : false,
                        }
                    }
                    if (textures.textures.CAPE) {
                        auth.cape = textures.textures.cape.data;
                    }
                }

                context.commit('login', {
                    auth,
                })
            } catch (e) {
                context.commit('clear');
            }
        },
        /**
         * 
         * @param {ActionContext} context 
         * @param {{account:string, password?:string}} payload 
         * @return {Promise<Auth>}
         */
        async login(context, payload) {
            const mode = context.state.mode;
            if (context.getters.modes.indexOf(mode) === -1) {
                throw new Error(`Cannot find auth named ${mode}`);
            }
            const loginOption = {
                username: payload.account,
                password: payload.password,
                clientToken: context.state.clientToken,
            };
            const result = await context.dispatch(`${mode}/login`, loginOption);
            if (!result) throw new Error(`Cannot auth the ${payload.account}`);
            try {
                if (mode !== 'offline') {
                    /**
                     * @type {GameProfile}
                     */
                    const gameProfile = await context.dispatch('gameprofile/fetch', { service: mode, uuid: result.selectedProfile.id, cache: true }, { root: true });
                    
                    /**
                     * @type {GameProfile.Textures}
                     */
                    const textures = gameProfile.textures;
                    if (textures) {
                        const skin = textures.textures.skin;
                        if (skin) {
                            result.skin = {
                                data: skin.data,
                                slim: skin.metadata ? skin.metadata.model === 'slim' : false,
                            }
                        }
                        if (textures.textures.cape) {
                            result.cape = textures.textures.cape.data;
                        }
                    }
                }
            } catch (e) {
                console.warn(e);
            }
            try {
                result.info = await MojangService.getAccountInfo(result.accessToken);
            } catch (e) {
                console.warn(e);
            }
            context.commit('login', {
                auth: result,
                account: payload.account,
            });
            return result;
        },
    },
}
