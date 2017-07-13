const { EventEmitter } = require('events')
export default class Lancher extends EventEmitter {
    constructor(root, app, modules) {
        this.root = root
        this.app = app
        this._modules = modules
    }

    get profiles() { return path.join(root, 'profiles') }
    get resourcepacks() { return path.join(root, 'resourcepacks') }
    get mods() { return path.join(root, 'mods') }

    _onload(root) {

    }
    require(module) {

    }
}