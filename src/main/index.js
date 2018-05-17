import { app } from 'electron';
import configSetup from './config'
import windowSetup from './windowsManager'
import storeSetup from './store'

const devMod = process.env.NODE_ENV === 'development'
/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (!devMod) {
    global.__static = require('path').join(__dirname, '/static').replace(/\\/g, '\\\\')
}


/**
 * @type {vuex.Store}
 */
let store;
const setup = configSetup()
    .then(storeSetup)
    .then(windowSetup)
    .then((result) => {
        store = result;
    });

export function commit(type, payload, option) {
    setup.then(() => store.commit(type, payload, option))
}

export function dispatch(type, payload, option) {
    return setup.then(() => store.dispatch(type, payload, option))
}
