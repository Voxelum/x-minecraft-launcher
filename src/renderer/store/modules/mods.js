import { Mod } from 'ts-minecraft'
import repository from './models/repository'

const state = () => {
    const s = repository.state()
    s.root = 'mods'
    return s;
}
const getters = {
    ...repository.getters,
    // modmap(states, gets) {
    //     const values = gets.values;
    //     const map = {
    //         forge: {},
    //         liteloader: {},
    //     }
    //     for (const container of values) {
    //         map[container.meta.type][container.meta.id] = container.meta
    //     }
    //     return map
    // },
    // mods: (states, gets) => {
    //     const resources = gets.values
    //     const tree = {}
    //     for (const resource of resources) {
    //         let id = resource.meta.id;
    //         id = id.substring(0, id.indexOf(':'));
    //         const metas = resource.meta.meta instanceof Array ?
    //             [...resource.meta.meta] : [resource.meta.meta]
    //         if (!tree[id]) {
    //             tree[id] = metas
    //         } else {
    //             tree[id].push(...metas)
    //         }
    //     }
    //     return Object.keys(tree).map(k => tree[k])
    // },
    // forgeMods: (states, gets) => gets.modmap.forge,
    // liteMods: (states, gets) => gets.modmap.liteloader,
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
