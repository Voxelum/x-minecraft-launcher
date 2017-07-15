import { Store } from 'vuex'

export default (storeOption, option) => {
    let storeOption$ = storeOption
    if (option) {
        let state = storeOption.state
        if (typeof state === 'function') {
            state = state()
        } else {
            state = Object.assign({}, state)
        }
        for (const key in Object.keys(state)) {
            if (option[key]) {
                state[key] = option[key]
            }
        }

        storeOption$ = Object.assign({}, storeOption)
        storeOption$.state = state
    }
    return new Store(storeOption$)
}
