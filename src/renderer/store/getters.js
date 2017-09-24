import paths from 'path'

export default {
    /**
     * Return the errros by module.
     * @param {* State} state The vuex root state
     * @param {* Getters} getters The vuex root getters
     */
    errors(state, getters) {
        const errors = {}
        for (const key in state) {
            if (state.hasOwnProperty(key)) {
                const get = getters[`${key}/errors`]
                if (get && get.length !== 0) {
                    errors[key] = get
                }
            }
        }
        if (state.javas.length === 0) errors.settings = ['setting.install.java']
        return errors;
    },
    tasks(state, getters) {
        return {}
    },
    errorsCount: (state, getters) => Object.keys(getters.errors)
        .map((k, i, arr) => getters.errors[k].length).reduce((a, b) => a + b, 0),
    tasksCount: (states, getters) => Object.keys(getters.tasks)
        .map((k, i, arr) => getters.tasks[k].length).reduce((a, b) => a + b, 0),
    rootPath(state, getters) {
        return state.root
    },
    root: state => state.root,
    themes: state => state.themes,
    theme: state => state.theme,
    javas: state => state.javas,
    options: state => state.templates.minecraft,
    defaultJava: state => (state.javas.length !== 0 ? state.javas[0] : undefined),
    defaultOptions: state => state.templates.minecraft.midum,
}
