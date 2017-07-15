import {
    app,
    BrowserWindow,
    ipcMain
} from 'electron'
import {
    AuthService
} from 'ts-minecraft'

const devMod = process.env.NODE_ENV == 'development'
/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (!devMod) {
    global.__static = require('path').join(__dirname, '/static').replace(/\\/g, '\\\\')
}

let mainWindow
const winURL = process.env.NODE_ENV === 'development' ?
    `http://localhost:9080` :
    `file://${__dirname}/index.html`


function createWindow() {
    /**
     * Initial window options
     */
    mainWindow = new BrowserWindow({
        height: 563,
        useContentSize: true,
        width: 1000,
        frame: false
    })

    mainWindow.loadURL(winURL)

    mainWindow.on('closed', () => {
        mainWindow = null
    })
}

function init() {
    ipcMain.on('init', (event, args) => {

        event.sender.send('init', 'pong')
    })

    ipcMain.on('login', (event, args) => {
        let [account, password, mode] = args
        if (mode == 'offline') {
            event.sender.send('login', undefined, AuthService.offlineAuth(account))
        } else
            AuthService.newYggdrasilAuthService().login(account, password, 'non').then(
                result => {
                    event.sender.send('login', undefined, result)
                },
                err => {
                    event.sender.send('login', err)
                }
            )
    })
    ipcMain.on('launch', (event, options) => {
        switch (options.type) {
            case 'server':
            case 'modpack':
        }
    })
    ipcMain.on('save', (event, args) => {
        args.type
    })
}
app.on('ready', () => {
    init()
    createWindow()
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow()
    }
})

const paths = require('path')

function _buildTree() {
    //well this is future work 2333 
    //TODO toposort for module with dependencies and build tree 
}

import launcher from './launcher'

(function () {
    const context = {
        getPath(path) {
            if (typeof path === 'string') {
                return paths.join(launcher.rootPath, path)
            } else if (path instanceof Array) {
                console.log("paths " + path)
                return paths.join(launcher.rootPath, path.join(path))
            }
        }
    }

    let modules = launcher._modules
    let promises = []
    for (var key in modules) {
        if (modules.hasOwnProperty(key)) {
            var m = modules[key];
            promises.push(m.load(context))
        }
    }
    console.log('loaded modules')
    return Promise.all(promises)
})().catch(e => {
    console.log(e)
});

(function () {
    console.log('services start init')
    let services = launcher._services
    for (var key in services) {
        if (services.hasOwnProperty(key)) {
            var service = services[key];
            if (service.initialize)
                service.initialize();
        }
    }
    console.log('services inited')
})();
