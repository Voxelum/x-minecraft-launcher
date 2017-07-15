import { v4 } from 'uuid'

export default {
    namespaced: true,
    state: {
        all: {},
        selected: new Set(),
    },
    getters: {
        all: state => state.all,
        selected: state => state.all[state.select],
    },
    mutations: {
        select(state, id) {
            if (state.all[id]) {
                state.selected = state.all[id]
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
