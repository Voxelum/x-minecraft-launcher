import { Mod } from 'ts-minecraft'
import repository from './repository'

const state = () => {
    const s = repository.state()
    s.root = 'mods'
    return s;
}
const getters = {
    ...repository.getters,
};
const mutations = repository.mutations;
const actions = {
    ...repository.actions,
    meta(context, { name, data }) {
        return Mod.parse(data);
    },
}

export default {
    namespaced: true,
    state,
    getters,
    mutations,
    actions,
}
