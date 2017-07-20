import Vue from 'vue'

const files = require.context('.', false, /\.vue$/)
const widgets = {}

files.keys().forEach((key) => {
    widgets[key.replace(/(\.\/|\.vue)/g, '')] = files(key).default
})

export default widgets
