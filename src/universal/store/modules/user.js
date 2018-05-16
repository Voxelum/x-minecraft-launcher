import Vue from 'vue'
import { Auth, GameProfile } from 'ts-minecraft'
import { ActionContext } from 'vuex'
import { v4 } from 'uuid'

import auths from './user/auth';
import profiles from './user/profile';

export default {
    namespaced: true,
    state: {
        /**
         * @type {Auth}
         */
        auth: {
            selectedProfile: {
                id: '',
            },
        },
        skin: {
            data: '',
            slim: false,
        },
        cape: '',
        info: {},
    },
    modules: {
        auths,
        profiles,
    },
    getters: {
        modes: state => state.auths.modes,
        mode: state => state.auths.mode,
        username: state => (state.auth.selectedProfile ? state.auth.selectedProfile.name : ''),
        id: state => (state.auth.id ? state.auth.id : ''),
        skin: state => (state.skin),
        info: state => state.info,
        cape: state => state.cape,
        history: state => state.auths.history[state.mode],
        logined: state => typeof state.auth === 'object' && Object.keys(state.auth).length !== 0,
    },
    mutations: {
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
            state.auth = config.auth || state.auth;
            state.skin = config.skin || state.skin;
            state.cape = config.cape || state.cape;
        },

        login(state, auth) {
            state.auth = Object.assign({}, auth);
        },
        clear(state) { state.auth = {}; },
    },

    actions: {
        save(context, payload) {
            const { mutation } = payload;
            const data = JSON.stringify({
                auth: context.state.auth,
                skin: context.state.skin,
                cape: context.state.cape,

                clientToken: context.state.auths.clientToken,
                history: context.state.auths.history,
                mode: context.state.auths.mode,
            })
            return context.dispatch('write', { path: 'auth.json', data }, { root: true });
        },
        async load(context) {
            const data = await context.dispatch('read', { path: 'auth.json', fallback: {}, type: 'json' }, { root: true });
            context.commit('config', data);
            context.commit('auths/config', data);
            // context.commit('profiles/config', data);
            await context.dispatch('refresh');
        },
        /**
         * 
         * @param {ActionContext} context 
         * @param {string} mode 
         */
        selectLoginMode(context, mode) { context.commit('auths/mode', mode); },
        /**
         * Logout and clear current cache.
         */
        async logout(context) {
            if (context.getters.logined) {
                await context.dispatch('auths/invalide', {
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
            const gameProfile = await context.dispatch('profiles/fetch', {
                uuid: context.state.auth.selectedProfile.id,
                cache: true,
            });
            const textures = await context.dispatch('profiles/getTextures', gameProfile);
            if (textures) context.commit('textures', textures);
        },
        async refreshInfo(context) {
            if (context.state.auths.mode === 'offline') return;
            const info = await context.dispatch('mojang/fetchUserInfo', context.state.auth.accessToken, { root: true });
            context.commit('info', info);
        },
        /**
         * Refresh the current user login status
         */
        async refresh(context) {
            if (!context.getters.logined) return;

            const validate = await context.dispatch('auths/validate', {
                accessToken: context.state.auth.accessToken,
            });

            try {
                await context.dispatch('refreshSkin');
            } catch (e) {
                console.warn(e);
            }

            if (validate) { return; }
            try {
                const auth = await context.dispatch('auths/refresh', {
                    accessToken: context.state.auth.accessToken,
                });
                context.commit('login', auth);
            } catch (e) {
                context.commit('clear');
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
         * @param {{ data:Buffer, slim:boolean }} payload 
         */
        async uploadTexture(context, payload) {
            return context.dispatch('profiles/setTexture', payload);
        },
        /**
         * Login the user by current login mode. Refresh the skin and account information.
         * 
         * @param {ActionContext} context 
         * @param {{account:string, password?:string}} payload 
         */
        async login(context, payload) {
            const loginOption = {
                username: payload.account,
                password: payload.password,
            };
            const result = await context.dispatch('auths/login', loginOption).catch((e) => {
                if (e.message && e.message.startsWith('getaddrinfo ENOTFOUND')) {
                    const err = { message: 'error.internetNotConnected' }
                    throw err;
                }
                throw e;
            });
            if (!result) throw new Error(`Cannot auth the ${payload.account}`);
            context.commit('login', result);
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
