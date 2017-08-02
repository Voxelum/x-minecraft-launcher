function state() {
    return {
        type: '',

        name: '', // specific info
        version: '',

        resourcepacks: [], // official setting
        mods: [],
        setting: {},

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
}
const mutations = {
    setName(states, name) {
        states.name = name
    },
    setVersion(states, version) {
        states.version = version
    },
    putAll(states, option) {
        for (const key in option) {
            if (option.hasOwnProperty(key) && states.hasOwnProperty(key)) {
                states[key] = option[key];
            }
        }
    },
}

const actions = {}

export default {
    state,
    getters,
    mutations,
    actions,
}
