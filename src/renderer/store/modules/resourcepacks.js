import repository from './models/repository'

const state = () => {
    const s = repository.state()
    s.root = 'resourcepacks'
    return s;
}
const getters = repository.getters;
const mutations = repository.mutations;
const actions = Object.assign({
    save(context, payload) {
    },
    load() { 

    },
}, repository.actions)

export default {
    namespaced: true,
    state,
    getters,
    mutations,
    actions,
}
