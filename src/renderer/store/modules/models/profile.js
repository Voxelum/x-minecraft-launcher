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
        vmOptions: [],
        mcOptions: [],
    }
}
const getters = {
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
    state,
    getters,
    mutations,
    actions,
}
