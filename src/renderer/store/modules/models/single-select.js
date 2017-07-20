export default {
    namespaced: true,
    state() {
        return {
            _all: [],
            _selected: '',
        }
    },
    getters: {
        selected: state => state[state._selected],
        allStates: state => state._all.map(mName => state[mName]),
        getByKey: state => id => state[id],
        selectedKey: state => state._selected,
        allKeys: state => state._all,
    },
    mutations: {
        select(state, moduleID) {
            const idx = state._all.indexOf(moduleID);
            if (idx !== -1) state._selected = moduleID;
        },
        add(state, payload) {
            state._all.push(payload.id)
        },
        remove(state, id) {
            if (state._all.indexOf(id) !== -1) {
                if (state._selected === id) {
                    state._selected = state._all[0]
                }
                state._all = state._all.filter(v => v === id)
            }
        },
    },
    actions: {},
}
