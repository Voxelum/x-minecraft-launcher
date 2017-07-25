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

ipcMain.on('ping', (event) => {
    event.sender.send('pong')
})

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

function _buildTree() {
    // well this is future work 2333 
    // TODO toposort for module with dependencies and build tree 
}

const launcher = require('./launcher');
const services = require('./services').default;
// const modules = require('./module-io').default;

console.log('Start services initialize')

for (const key in services) {
    if (services.hasOwnProperty(key)) {
        const service = services[key];
        if (service.initialize) {
            console.log(`Initializes service ${key}`)
            service.initialize();
        }
    }
}
