import { ModContainer } from 'ts-minecraft'
import repository from './models/repository'

const state = () => {
    const s = repository.state()
    s.root = 'mods'
    return s;
}
const getters = {
    ...repository.getters,
    modmap(states, gets) {
        const values = gets.values;
        const map = {
            forge: {},
            liteloader: {},
        }
        for (const container of values) {
            map[container.meta.type][container.meta.id] = container.meta
        }
        return map
    },
    forgeMods: (states, gets) => gets.modmap.forge,
    liteMods: (states, gets) => gets.modmap.liteloader,
};
const mutations = repository.mutations;
const actions = {
    ...repository.actions,
    meta(context, { name, data }) {
        return ModContainer.parseForge(data).catch(e => ModContainer.parseLiteLoader(data))
    },
}

export default {
    namespaced: true,
    state,
    getters,
    mutations,
    actions,
}
