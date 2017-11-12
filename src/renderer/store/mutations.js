export default {
    copyOptions(states, { from, to }) {
        const setting = states.templates.minecraft[from]
    },
    resolution: (state, resolution) => {
        state.resolution = resolution;
    },
}
