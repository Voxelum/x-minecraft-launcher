const files = require.context('.', false, /\.vue$/)
const modules = {}

files.keys().forEach((key) => {
    modules[key.replace(/(\.\/|\.vue)/g, '')] = files(key)
})

export default {
    components: {
        ...modules,
    },
    render(createElement) {
        return createElement('div', {},
            Object.keys(modules).map(name => createElement(name, {
                ref: name.toLowerCase(),
            })))
    },
    mounted() {
        this.$ipc.$on('modal', this.show)
    },
    methods: {
        show(id, args) {
            const modal = this.$refs[`${id}modal`.toLowerCase()]
            if (modal) modal.show(args); // $(modal).modal('show') // eslint-disable-line
            else console.warn(`No modal named ${id}`)
        },
    },
}
