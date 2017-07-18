import {
    v4,
} from 'uuid'
import {
    Store,
} from 'vuex'

const singleSelect = {
    state() {
        return {
            _all: [],
            _selected: '',
        }
    },
    getters: {
        selected: state => state[state._select],
        allState: state => state._all.map(mName => state[mName]),
    },
    mutations: {
        select(state, moduleID) {
            const idx = state._all.indexOf(moduleID);
            if (idx !== -1) state._selected = moduleID;
        },
        add(state, newOne) {
            let id;
            if (newOne instanceof Store) {
                id = newOne.state.id
            } else id = newOne.id
            if (!id) id = v4()
            state.all.push(id)
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
}
export function singleSelective(option) {

}

export default {
    namespaced: true,
    state() {
        return {
            all: [],
            selected: '',
        }
    },
    getters: {
        selected: state => state[state.select].state,
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
            state.all.push(id)
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
