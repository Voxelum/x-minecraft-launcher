import { ResourcePack } from 'ts-minecraft'
import repository from './models/repository'

const state = () => {
    const s = repository.state()
    s.root = 'resourcepacks'
    return s;
}
const getters = repository.getters;
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
