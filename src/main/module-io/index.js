const files = require.context('.', false, /\.js$/)
const modules = {}

files.keys().forEach(key => {
    if (key === './index.js') return
    let id = key.replace(/(\.\/|\.js)/g, '')
    let instance = files(key).default
    if(!instance.id) instance.id = id
    modules[name] = instance
})

export default modules
