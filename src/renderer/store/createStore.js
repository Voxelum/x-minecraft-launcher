import {
    Store,
} from 'vuex'

export default (storeOption, option) => {
    let state = storeOption.state
    if (typeof state === 'function') {
        state = state()
    } else {
        state = Object.assign({}, state)
    }
    if (option) {
        for (const key in state) {
            if (option[key]) {
                state[key] = option[key]
            }
        }
    }
    const storeOption$ = Object.assign({}, storeOption)
    storeOption$.state = state
    const store = new Store(storeOption$)
    return store
}
