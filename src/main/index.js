import {
    app,
    BrowserWindow,
    ipcMain,
} from 'electron'
import {
    AuthService,
} from 'ts-minecraft'

const devMod = process.env.NODE_ENV === 'development'
/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (!devMod) {
    global.__static = require('path').join(__dirname, '/static').replace(/\\/g, '\\\\')
}

let mainWindow
const winURL = process.env.NODE_ENV === 'development' ?
    'http://localhost:9080' :
    `file://${__dirname}/index.html`


function createWindow() {
    /**
     * Initial window options
     */
    mainWindow = new BrowserWindow({
        height: 563,
        useContentSize: true,
        width: 1000,
        frame: false,
    })

    mainWindow.loadURL(winURL)

    mainWindow.on('closed', () => {
        mainWindow = null
    })
}

app.on('ready', () => {
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
    // well this is future work 2333 
    // TODO toposort for module with dependencies and build tree 
}

let _reqTreeEventHolder
ipcMain.once('fetchAll', (event) => {
    if (_reqTreeEventHolder) {
        console.log('IO loaded first!')
        event.sender.send('fetchAll', undefined, _reqTreeEventHolder)
    } else {
        console.log('Client loaded first!')
        _reqTreeEventHolder = event
        // place holder, which means tree already required by the renderer process!
    }
    ipcMain.on('fetchAll', () => {
        console.log('remote force reload! implement later...')
    })
});

const launcher = require('./launcher'); // require launcher AFTER modules loaded

console.log('services start init')
const services = launcher._services
for (const key in services) {
    if (services.hasOwnProperty(key)) {
        const service = services[key];
        if (service.initialize) {
            service.initialize();
        }
    }
}
console.log('services inited');
(function () {
    const modules = launcher._modulesIO;
    const promises = [];
    for (const key in modules) {
        if (modules.hasOwnProperty(key)) {
            const m = modules[key];
            promises.push(m.load(launcher).then(mod => ({ id: key, module: mod })));
        }
    }
    return Promise.all(promises);
})().then((modules) => {
    console.log('loaded module');
    const tree = {};
    for (const m of modules) { tree[m.id] = m.module; }
    if (_reqTreeEventHolder) { _reqTreeEventHolder.sender.send('fetchAll', undefined, tree); } else { _reqTreeEventHolder = tree; }
    return tree
}).catch((e) => {
    console.log(e)
});

