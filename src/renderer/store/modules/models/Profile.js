import { v4 } from 'uuid'
/*export default {
    constructor(option) {
        this.id = v4()
        this.name = option.name || 'default'
        this.version = option
    }
}
*/
function state() {
    return {
        id: '',
        profile: ''
    }
}
const getters = {
    profiles: state => state.profiles,
    profile: state => state.profile,
    version: state => state.profiles[state.profile].version,
    resolution: state => state.profiles[state.profile].resolution,
    javalocation: state => state.profiles[state.profile].javalocation,
}
const mutations = {
    selectProfile(state, profile) {
        if (state.profiles[profile])
            state.profile = profile
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
