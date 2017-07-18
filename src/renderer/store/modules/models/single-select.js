import {
    v4,
} from 'uuid'
import {
    Store,
} from 'vuex'

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
            let id
            if (newOne instanceof Store) {
                id = newOne.state.id
            } else id = newOne.id
            if (!id) id = v4()
            state.dic[id] = newOne
            state.all.push(newOne)
            console.log('add')
        },
        remove(state, id) {
            if (state.dic[id]) {
                if (state.selected === id) {
                    state.selected = Object.keys[state.dic][0]
                }
                const removed = state.dic[id]
                state.dic[id] = undefined
                state.all = state.all.filter(v => v === removed)
            }
        },
    },
    actions: {},
}
