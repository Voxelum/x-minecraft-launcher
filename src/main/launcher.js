const {
    EventEmitter
} = require('events')
export default class Lancher extends EventEmitter {
    constructor(root, app, modules) {
        this.root = root
        this.app = app
        this._modules = modules
    }

    get profiles() {
        return path.join(root, 'profiles')
    }
    get resourcepacks() {
        return path.join(root, 'resourcepacks')
    }
    get mods() {
        return path.join(root, 'mods')
    }

    registerService(id, service) {

    }
    _buildTree() {
        //TODO toposort for module with dependencies and build tree 
    }
    _onload(modules) {
        let tree = _buildTree()
        for (let branch of tree) {
            branch.batch(this)
        }
        Promise.all()
    }
    require(module) {

    }
}