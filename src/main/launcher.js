const {
    EventEmitter
} = require('events')
import {
    app,
    BrowserWindow,
    ipcMain
} from 'electron'
const paths = require('path')
import modules from './module-io'
import services from './services'

class Launcher extends EventEmitter {
    constructor(root, app, modules, services) {
        super()
        this.rootPath = root
        this.app = app
        this._modules = modules
        this._services = services
    }

    getPath(path) {
        if (typeof path === 'string') {
            return paths.join(this.rootPath, path)
        } else if (path instanceof Array) {
            console.log("paths " + path)
            return paths.join(this.rootPath, path.join(path))
        }
    }

    require(module) {
        //this need to design...
    }
}
const launcher = new Launcher(paths.join(app.getPath('appData'), '.launcher'), app, modules, services)
export default launcher