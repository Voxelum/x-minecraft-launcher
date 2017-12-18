const files = require.context('./spec', false, /\.js$/)
const modules = []

files.keys().forEach((key) => {
    if (key === './index.js') return
    modules.push(files(key).default)
})

export default modules
