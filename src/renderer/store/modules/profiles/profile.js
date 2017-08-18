import settings from './settings'

function state() {
    return {
        type: '',
        name: '', // specific info
        resolution: { width: 800, height: 400, fullscreen: false }, // client setting
        java: '',
        minMemory: 1024,
        maxMemory: 2048,
        vmOptions: [],
        mcOptions: [],
    }
}
const getters = {
    errors(states) {
        const errors = []
        if (states.minecraft.version === '' || states.minecraft.version === undefined || states.minecraft.version === null) errors.push('profile.empty.version')
        if (states.java === '' || states.java === undefined || states.java === null) errors.push('profile.empty.java')
        return errors
    },
    versoin: states => states.minecraft.version,
    language: (states, gets) => gets['minecraft/options'].lang,
}
const mutations = {
    putAll(states, option) {
        for (const key in option) {
            if (option.hasOwnProperty(key) && states.hasOwnProperty(key)) {
                states[key] = option[key];
            }
        }
    },
}

const actions = {
}

export default {
    modules: {
        ...settings,
    },
    state,
    getters,
    mutations,
    actions,
}
