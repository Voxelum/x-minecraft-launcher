export default (module) => {
    if (!module.namespaced) return;
    const mutations = module.mutations || {}
    if (!module.state) return;
    const keys = Object.keys(module.state)
    mutations.$reload = (state, newState) => {
        for (const key of keys) {
            if (state.hasOwnProperty(key) && newState.hasOwnProperty(key)) {
                state[key] = newState[key]
                console.log(`[${key}]: replace ${state[key]} with ${newState[key]}`)
            }
        }
    }
    module.mutations = mutations
}
