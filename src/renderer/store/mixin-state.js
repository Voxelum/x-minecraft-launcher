function mix(target, src) {
    for (const key in target) {
        if (target.hasOwnProperty(key) && src.hasOwnProperty(key)) {
            if (typeof target[key] === 'object' && typeof src[key] === 'object') {
                mix(target[key], src[key]);
            } else {
                target[key] = src[key];
            }
        }
    }
}
export function copy(obj) {
    return JSON.parse(JSON.stringify(obj))
}
export default (template, option) => {
    let state = template.state
    if (typeof state === 'function') {
        state = state()
    } else {
        state = copy(state)
    }
    if (option) mix(state, option)

    const storeOption$ = Object.assign({}, template)
    storeOption$.state = state
    return storeOption$;
}
