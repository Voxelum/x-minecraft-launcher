const devMod = process.env.NODE_ENV === 'development'
/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (!devMod) {
    global.__static = require('path').join(__dirname, '/static').replace(/\\/g, '\\\\')
}

/* eslint-disable */
import configSetup from './config'
export { commit, dispatch } from './store'
import windowSetup from './windowsManager'
/* eslint-enable */
