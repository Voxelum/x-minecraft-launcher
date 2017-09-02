import { ResourcePack } from 'ts-minecraft'

import repository from './models/repository'

const state = () => {
    const s = repository.state()
    s.root = 'resourcepacks'
    return s;
}
const getters = {
    ...repository.getters,
    namemap(states, gets) {
        const map = {}
        for (const pack of gets.values) {
            map[pack.name] = pack.meta
        }
        return map;
    },
};
const mutations = repository.mutations;
const actions = {
    ...repository.actions,
    meta(context, { name, data }) {
        return ResourcePack.readFromBuffer(name, data, true)
    },
}

export default {
    namespaced: true,
    state,
    getters,
    mutations,
    actions,
}
