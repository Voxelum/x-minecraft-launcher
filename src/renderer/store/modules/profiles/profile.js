import options from '../../../shared/options'

function state() {
    return {
        type: '',

        name: '', // specific info
        version: '',

        // resourcepacks: [], // official setting
        mods: [],
        settings: {
            minecraft: options,
            // forge: {},
            // optifine: {},
        },

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
    minecraftOptions: states => states.settings.minecraft,
    resourcepacks: states => states.settings.minecraft.resourcepacks,
    language: states => states.settings.minecraft.lang,
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
