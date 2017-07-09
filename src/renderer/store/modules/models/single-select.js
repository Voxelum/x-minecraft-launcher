import { v4 } from 'uuid'

export default {
    namespaced: true,
    state() {
        return {
            all: {},
            selected: ''
        }
    },
    getters: {
        all: state => state.all,
        selected: state => all[state.select]
    },
    mutations: {
        select(state, id) {
            if (state.all[id])
                state.selected = state.all[id]
        },
        add(state, newOne) {
            let id = newOne.id
            if (!id) id = v4()
            all[id] = newOne
        },
        remove(state, id) {
            if (state.all[id]) {
                if (state.selected == id)
                    state.selected = Object.keys[all][0]
                state.all[id] = undefined
            }
        }
    },
    actions: {
    }
}