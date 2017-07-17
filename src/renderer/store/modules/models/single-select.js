import {
    v4
} from 'uuid'

export default {
    namespaced: true,
    state() {
        return {
            dic: {},
            all: [],
            selected: '',
        }
    },
    getters: {
        selected: state => state.dic[state.select],
    },
    mutations: {
        select(state, id) {
            if (state.dic[id]) {
                state.selected = state.dic[id]
            }
        },
        add(state, newOne) {
            let id = newOne.id
            if (!id) id = v4()
            state.dic[id] = newOne
            state.all.push(newOne)
        },
        remove(state, id) {
            if (state.dic[id]) {
                if (state.selected === id) {
                    state.selected = Object.keys[state.dic][0]
                }
                state.dic[id] = undefined
            }
        },
    },
    actions: {},
}
