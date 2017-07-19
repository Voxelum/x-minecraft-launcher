import {
    Store,
} from 'vuex'

export default (template, option) => {
    let state = template.state
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
    const storeOption$ = Object.assign({}, template)
    storeOption$.state = state
    console.log(option)
    console.log(state)
    return storeOption$;
}
