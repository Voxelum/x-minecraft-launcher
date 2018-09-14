function $mixin(target, option) {
    const container = Object.assign({}, target);
    for (const key in option) {
        if (option.hasOwnProperty(key)) {
            const single = option[key];
            if (!container[key]) {
                container[key] = single;
            }
        }
    }
    return container;
}
function flat(state) {
    if (typeof state === 'function') return state();
    return state;
}
export default (target, option) => {
    const inst = {
        state: $mixin(flat(target.state || {}), flat(option.state || {})),
        getters: $mixin(target.getters || {}, option.getters || {}),
        mutations: $mixin(target.mutations || {}, option.mutations || {}),
        actions: $mixin(target.actions || {}, option.actions || {}),
    };
    return inst;
};
