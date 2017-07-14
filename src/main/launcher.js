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

class Lancher extends EventEmitter {
    constructor(root, app, modules, services) {
        super()
        this.root = root
        this.app = app
        this._modules = modules
        this._services = services
    }

    getPath(...path) {
        paths.join(this.root, path)
    }

    _buildTree() {
        //well this is future work 2333 
        //TODO toposort for module with dependencies and build tree 
    }
    _onload() {
        console.log('load modules')
        let tree = _buildTree()
        for (let branch of tree) {
            branch.batch(this)
        }
    }

    _onServiceInit() {
        console.log('services init')
        this._services
    }


    require(module) {
        //this need to design...
    }
}
const launcher = new Launcher(path.join(app.getPath('appData'), '.launcher'), app, modules, services)
launcher._onload()
launcher._onServiceInit()
export default launcher