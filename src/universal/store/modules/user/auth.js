import { Auth } from 'ts-minecraft'
import { v4 } from 'uuid'
import Vue from 'vue'
import { Module } from 'vuex'

export default {
    namespaced: true,
    state: {
        mode: 'mojang',
        /**
         * record the logined username
         * @type {{[mode:string]: string[]}}
         */
        history: {},
        clientToken: v4(),
        modes: ['offline', 'mojang'],
    },
    mutations: {
        /**
         * 
         * @param {*} state 
         * @param {string} username 
         */
        login(state, username) {
            if (!state.history[state.mode]) Vue.set(state.history, state.mode, [])
            if (username) {
                const his = state.history[state.mode];
                const idx = his.indexOf(username);
                if (idx === -1) {
                    his.unshift(username);
                } else {
                    const first = his[0];
                    Vue.set(his, 0, username);
                    Vue.set(his, idx, first);
                }
            }
        },
        config(state, config) {
            state.clientToken = config.clientToken || state.clientToken;
            state.history = config.history || state.history;
            state.mode = config.mode || state.mode;
        },
        addMode(state, mode) {
            if (state.modes.indexOf(mode) !== -1) return;
            state.modes.push(mode);
        },
        removeMode(state, mode) {
            if (mode === 'offline' || 'mojang') return;
            const index = state.modes.indexOf(mode);
            if (index === -1) return;
            Vue.delete(state.modes, index);
        },

    },
    actions: {
        login: (context, option) => context.dispatch(`${context.state.mode}/login`, { ...option, clientToken: context.state.clientToken })
            .then((auth) => {
                context.commit('login', option.username);
                return auth;
            }),
        refresh: (context, option) => context.dispatch(`${context.state.mode}/refresh`, { ...option, clientToken: context.state.clientToken }),
        validate: (context, option) => context.dispatch(`${context.state.mode}/validate`, { ...option, clientToken: context.state.clientToken }),
        invalide: (context, option) => context.dispatch(`${context.state.mode}/invalide`, { ...option, clientToken: context.state.clientToken }),
        signout: (context, option) => context.dispatch(`${context.state.mode}/signout`, option),

        /**
         * Register an auth module.
         * 
         * @param {*} context 
         * @param {{id: string, module: Module}} payload 
         */
        registerAuthModule(context, payload) {
            if (!payload || !payload.id || !payload.module) throw new Error('');
            return context.dispatch('registerModule', {
                path: `user/auths/${payload.id}`,
                module: payload.module,
            }).then(() => {
                context.commit('addMode', payload.id);
            })
        },
        /**
         * Unregister an auth module.
         * 
         * @param {*} context 
         * @param {*} id 
         */
        unregisterAuthModule(context, id) {
            if (!id) throw new Error('');
            return context.dispatch('unregisterModule', {
                path: `user/auths/${id}`,
            }).then(() => {
                context.commit('removeMode', id);
            })
        },
    },
    modules: {
        mojang: {
            namespaced: true,
            actions: {
                login: (context, option) => Auth.Yggdrasil.login(option),
                refresh: (context, option) => Auth.Yggdrasil.refresh(option),
                validate: (context, option) => Auth.Yggdrasil.validate(option),
                invalide: (context, option) => Auth.Yggdrasil.invalide(option),
                signout: (context, option) => Auth.Yggdrasil.signout(option),
            },
        },
        offline: {
            namespaced: true,
            actions: {
                login: (context, option) => Auth.offline(option.username),
                refresh() { },
                validate() { return true; },
                invalide() { },
                signout() { },
            },
        },
    },
}
