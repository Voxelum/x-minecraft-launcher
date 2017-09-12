const files = require.context('.', true, /router\.js$/)
const modules = []

files.keys().forEach((key) => {
    modules.push(files(key).default)
    // modules[key.replace(/(\.\/|\.js)/g, '').replace('/router', '')] = files(key).default
})

export default modules
