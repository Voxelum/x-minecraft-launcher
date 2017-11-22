import { ResourcePack } from 'ts-minecraft'
import { ActionContext } from 'vuex'
import repository from './repository'

const state = () => {
    const s = repository.state()
    s.root = 'resourcepacks'
    s.metaType = 'resourcepack'
    return s;
}
const getters = {
    ...repository.getters,
    namemap(states, gets) {
        const map = {}
        for (const pack of gets.values) map[pack.name] = pack.meta
        return map;
    },
};
const mutations = repository.mutations;
const actions = {
    ...repository.actions,
}

export default {
    namespaced: true,
    state,
    getters,
    mutations,
    actions,
}
