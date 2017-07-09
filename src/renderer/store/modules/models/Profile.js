function state() {
    return {
        id: '',
        name: '',
        version: '',
        resolution: [800, 400],
        java: '',
        resourcepacks: [],
        mods: [],
        setting: {},
        vmOptions: [],
        mcOptions: []
    }
}
const getters = {
    id: state => state.id,
    name: state => state.name,
    version: state => state.version,
    resolution: state => state.resolution,
    java: state => state.java,
    resourcepacks: state => state.resourcepacks,
    mods: state => state.mods,
    setting: state => state.setting,
    vmOptions: state => state.vmOptions,
    mcOptions: state => state.mcOptions
}
const mutations = {
    version(state, version) {
        state.version = version
    },
    resolution(state, resolution) {
        state.resolution = resolution
    },
    javaLocation(state, location) {
        state.location = location
    },
    name(state, name) { state.name = name }
}

const actions = {
}

export default {
    state,
    getters,
    mutations,
    actions
}
