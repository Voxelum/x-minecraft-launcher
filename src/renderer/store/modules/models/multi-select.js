import { v4 } from 'uuid'

export default {
    namespaced: true,
    state: {
        _all: [],
        _selected: [],
    },
    getters: {
        allState: state => state._all.map(k => state[k]),
        selectedState: state => state._selected.map(k => state[k]),
        selectedKey: state => state._selected,
        allKey: state => state._all,
    },
    mutations: {
        select(state, id) {
            if (state[id]) {
                state._selected.push(id)
            }
        },
        unselect(state, id) {
            state.selected.delete(id)
        },
        add(state, newOne) {
            let id = newOne.id
            if (!id) id = v4()
            state.all[id] = newOne
        },
        remove(state, id) {
            if (state.all[id]) {
                if (state.selected.has(id)) {
                    state.selected.delete(id)
                }
                state.all[id] = undefined
            }
        },
    },
    actions: {
    },
}
