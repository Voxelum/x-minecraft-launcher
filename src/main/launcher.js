const {
    EventEmitter
} = require('events')
import {
    app,
    BrowserWindow,
    ipcMain
} from 'electron'
const paths = require('path')
class Lancher extends EventEmitter {
    constructor(root, app, modules, service) {
        this.root = root
        this.app = app
        this._modules = modules
        this._service = service
    }

    getPath(...path) {
        paths.join(this.root, path)
    }

    _buildTree() {
        //well this is future work 2333 
        //TODO toposort for module with dependencies and build tree 
    }
    _onServiceInit() {

    }
    _onload() {
        let tree = _buildTree()
        for (let branch of tree) {
            branch.batch(this)
        }
    }

    require(module) {
        //this need to design...
    }
}
const modules = require('./module-io')
const service = require('./service')
const launcher = new Launcher(path.join(app.getPath('appData'), '.launcher'), app, modules, service)
export default launcher