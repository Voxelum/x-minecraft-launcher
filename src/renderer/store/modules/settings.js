
import paths from 'path'
import { remote } from 'electron'
import mcsettings from './mcsettings'

(() => {
    const options = require('shared/options')
    for (const key in mcsettings) {
        if (mcsettings.hasOwnProperty(key)) {
            mcsettings[key] = Object.assign(mcsettings[key], options)
        }
    }
})()

export default {
    namespaced: true,
    state() {
        return {
            defaultResolution: { width: 400, height: 400, fullscreen: false },
            autoDownload: false,
            templates: {
                minecraft: mcsettings,
            },
            javas: [],
            default: 'semantic',
            theme: 'semantic',
            themes: [], // todo... I think we need a more generic way... 
        }
    },
    mutations: {
        javas(states, payload) {
            if (payload instanceof Array) states.javas = payload;
        },
        copyOptions(states, { from, to }) {
            const setting = states.templates.minecraft[from]
        },
    },
    getters: {
        errors(states) {
            const e = []
            if (states.javas.length === 0) e.push('setting.install.java')
            return e;
        },
        javas: states => states.javas,
        options: states => states.templates.minecraft,
        defaultJava: states => (states.javas.length !== 0 ? states.javas[0] : undefined),
        defaultOptions: states => states.templates.minecraft.midum,
    },
    actions: {
        load(context, payload) {
            context.dispatch('searchJava').then((javas) => {
                context.commit('javas', javas);
            })
            return context.dispatch('read', { path: 'setting.json' }, { root: true })
        },
        save() {
            return {}
        },
        searchJava({ dispatch }) {
            return dispatch('query', { service: 'jre', action: 'availbleJre' }, { root: true })
        },
    },
}
