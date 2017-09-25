import paths from 'path'

export default {
    /**
     * Return the errros by module.
     */
    errors: (state, getters) => ({
        ...Object.keys(state)
            .map(key => ({ [key]: getters[`${key}/errors`] }))
            .filter(get => get && get.length !== 0)
            .reduce((a, b) => ({ ...a, ...b })),
        settings: (state.javas.length !== 0) ? ['setting.install.java'] : [],
    }),
    tasks(state, getters) {
        return {}
    },
    errorsCount: (state, getters) => Object.keys(getters.errors)
        .map((k, i, arr) => getters.errors[k].length).reduce((a, b) => a + b, 0),
    tasksCount: (states, getters) => Object.keys(getters.tasks)
        .map((k, i, arr) => getters.tasks[k].length).reduce((a, b) => a + b, 0),
    rootPath: (state, getters) => state.root,
    root: state => state.root,
    themes: state => state.themes,
    theme: state => state.theme,
    javas: state => state.javas,
    options: state => state.templates.minecraft,
    defaultJava: state => (state.javas.length !== 0 ? state.javas[0] : undefined),
    defaultOptions: state => state.templates.minecraft.midum,
}
