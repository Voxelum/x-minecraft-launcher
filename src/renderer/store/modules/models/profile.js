function state() {
    return {
        id: '', //meta-inf
        type: '',

        name: '', //specific info
        version: '',

        resourcepacks: [], //official setting
        mods: [],
        setting: {},

        resolution: [800, 400], //client setting
        java: '',
        vmOptions: [],
        mcOptions: []
    }
}
const getters = {
}
const mutations = {
    putAll(state, option) {
        for (var key in option)
            if (option.hasOwnProperty(key) && state.hasOwnProperty(key))
                state[key] = option[key];
    }
}

const actions = {
}

export default {
    state,
    getters,
    mutations,
    actions
}
