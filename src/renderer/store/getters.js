export default {
    errors(state, getters) {
        let errors = []
        for (const key in state) {
            if (state.hasOwnProperty(key)) {
                const get = getters[`${key}/errors`]
                if (get) {
                    errors = errors.concat(get)
                }
            }
        }
        return errors;
    },
    rootPath(state, getters) {
        return state.settings.rootPath
    },
}
