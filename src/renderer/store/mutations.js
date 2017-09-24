export default {
    url(states, url) {
        states.url = url;
    },
    javas(states, payload) {
        if (payload instanceof Array) states.javas = payload;
    },
    copyOptions(states, { from, to }) {
        const setting = states.templates.minecraft[from]
    },
    path(state, path) {
        state.path = path;
    },
}
