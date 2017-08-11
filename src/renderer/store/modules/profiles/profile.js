function state() {
    return {
        type: '',

        name: '', // specific info
        version: '',

        resolution: [800, 400], // client setting
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
        if (states.version === '' || states.version === undefined || states.version === null) errors.push('profile.empty.version')
        if (states.java === '' || states.java === undefined || states.java === null) errors.push('profile.empty.java')
        return errors
    },
    mods: (states, gets) => (gets.forge ? gets.forge.mods : []),
    resourcepacks: (states, gets) => gets['minecraft/resourcepacks'],
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
    toggle(states, option) { /* dummy mutation */ },
}

const actions = {
}

export default {
    state,
    getters,
    mutations,
    actions,
}
