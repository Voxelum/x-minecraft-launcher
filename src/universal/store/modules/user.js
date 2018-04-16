import Vue from 'vue'
import { Auth, MojangAccount, MojangService, GameProfile } from 'ts-minecraft'
import { ActionContext } from 'vuex'
import { v4 } from 'uuid'

const modules = {
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
}

export default {
    namespaced: true,
    state: {
        mode: 'mojang',
        /**
         * @type {{[mode:string]: string[]}}
         */
        history: {},
        clientToken: v4(),
        /**
         * @type {Auth}
         */
        auth: {
            selectedProfile: {
                id: '',
            },
        }, // cached
        skin: {
            data: '',
            slim: false,
        },
        cape: '',
        info: {},
    },
    modules,
    getters: {
        modes: state => ['mojang', 'offline'],
        mode: state => state.mode,
        username: state => (state.auth.selectedProfile ? state.auth.selectedProfile.name : ''),
        id: state => (state.auth.id ? state.auth.id : ''),
        skin: state => (state.skin),
        info: state => state.info,
        cape: state => state.cape,
        history: state => state.history[state.mode],
        logined: state => typeof state.auth === 'object' && Object.keys(state.auth).length !== 0,
    },
    mutations: {
        mode(state, mode) {
            state.mode = mode;
            if (!state.history[mode]) { state.history[mode] = [] }
        },
        /**
         * 
         * @param {*} state 
         * @param {GameProfile.Textures} textures 
         */
        textures(state, textures) {
            const skin = textures.textures.skin;
            const cape = textures.textures.cape;
            if (skin) {
                state.skin.data = skin.data;
                state.skin.slim = skin.metadata ? skin.metadata.model === 'slim' : false;
            }
            if (cape) {
                state.cape = cape.data;
            }
        },
        /**
         * 
         * @param {MojangAccount} info 
         */
        info(state, info) {
            state.info.id = info.id;
            state.info.email = info.email;
            state.info.username = info.username;
            state.info.registerIp = info.registerIp;
            state.info.dateOfBirth = info.dateOfBirth;
        },
        config(state, config) {
            state.clientToken = config.clientToken || state.clientToken;
            state.history = config.history || state.history;
            state.mode = config.mode || state.mode;
            state.auth = config.auth || state.auth;
            state.skin = config.skin || state.skin;
            state.cape = config.cape || state.cape;
        },

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
        clear(state) { state.auth = {}; },
    },

    actions: {
        save(context, payload) {
            const { mutation } = payload;
            const data = JSON.stringify(context.state,
                (key, value) => ((key === 'mojang' || key === 'offline' || key === 'info')
                    ? undefined : value), undefined, 4);
            return context.dispatch('write', { path: 'auth.json', data }, { root: true });
        },
        async load(context) {
            const data = await context.dispatch('read', { path: 'auth.json', fallback: {}, type: 'json' }, { root: true });
            context.commit('config', data);
            await context.dispatch('refresh');
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
        $refresh: {
            root: true,
            async handler(context) {
                try {
                    await context.dispatch('refreshSkin');
                } catch (e) {
                    console.warn(e);
                }
                try {
                    await context.dispatch('refreshInfo');
                } catch (e) {
                    console.warn(e);
                }
            },
        },
        async refreshSkin(context) {
            const mode = context.state.mode;
            const gameProfile = await context.dispatch('gameprofile/fetch', {
                service: mode,
                uuid: context.state.auth.selectedProfile.id,
                cache: true,
            }, { root: true });
            const textures = gameProfile.textures;
            if (textures) context.commit('textures', textures);
        },
        async refreshInfo(context) {
            const info = await MojangService.getAccountInfo(context.state.auth.accessToken);
            context.commit('info', info);
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
            if (context.state.mode === 'offline') return;

            const validate = await context.dispatch(`${mode}/validate`, {
                clientToken: context.state.clientToken,
                accessToken: context.state.auth.accessToken,
            });
            if (validate) { return; }
            try {
                const auth = await context.dispatch(`${mode}/refresh`, {
                    clientToken: context.state.clientToken,
                    accessToken: context.state.auth.accessToken,
                });
                context.commit('login', { auth })
            } catch (e) {
                context.commit('clear');
            }
            try {
                await context.dispatch('refreshSkin');
            } catch (e) {
                console.warn(e);
            }
            try {
                await context.dispatch('refreshInfo');
            } catch (e) {
                console.warn(e);
            }
        },
        /**
         * 
         * @param {ActionContext} context 
         * @param {{account:string, password?:string}} payload 
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
            const result = await context.dispatch(`${mode}/login`, loginOption).catch((e) => {
                if (e.message && e.message.startsWith('getaddrinfo ENOTFOUND')) {
                    const err = { message: 'error.internetNotConnected' }
                    throw err;
                }
                throw e;
            });
            if (!result) throw new Error(`Cannot auth the ${payload.account}`);
            context.commit('login', {
                auth: result,
                account: payload.account,
            });
            if (mode === 'offline') return;
            try {
                await context.dispatch('refreshSkin');
            } catch (e) {
                console.warn(e);
            }
            try {
                await context.dispatch('refreshInfo');
            } catch (e) {
                console.warn(e);
            }
        },
    },
}
