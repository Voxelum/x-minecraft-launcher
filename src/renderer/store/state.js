import mcsettings from './modules/mcsettings'

(() => {
    const options = require('shared/options')
    for (const key in mcsettings) {
        if (mcsettings.hasOwnProperty(key)) {
            mcsettings[key] = Object.assign(mcsettings[key], options)
        }
    }
})()

export default {
    defaultResolution: { width: 400, height: 400, fullscreen: false },
    autoDownload: false,
    templates: {
        minecraft: mcsettings,
    },
    url: '',
    javas: [],
    root: '',
    theme: 'semantic',
    themes: [], // todo... I think we need a more generic way... 
}
