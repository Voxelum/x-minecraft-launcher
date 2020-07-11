import { IS_DEV } from './constant';

if (!IS_DEV) {
    /**
     * Set `__static` path to static files in production
     * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
     */
    global.__static = require('path').join(__dirname, '/static').replace(/\\\\/g, '\\\\\\\\');
}

// eslint-disable-next-line import/first
import ElectronLauncherApp from './electron/ElectronLauncherApp';


new ElectronLauncherApp().start();
