const files = require.context('.', false, /\.js$/)
const modules = {}

files.keys().forEach((key) => {
    if (key === './index.js') return
    const id = key.replace(/(\.\/|\.js)/g, '')
    const instance = files(key).default
    if (!instance.id) instance.id = id
    modules[id] = instance
})

export default modules
