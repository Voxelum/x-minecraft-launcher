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
        ipcMain.on('launcher', (event, payload) => {
            let msgId = payload.id
            if (payload.service) {
                let service = payload.service.id
                let action = payload.service.action
                let args = payload.service.args
                let serInst = this._services[service]
                if (!serInst) {
                    event.sender.send(msgId, {
                        error: `No such service [${service}]`
                    })
                    return
                }
                let actionInst = serInst.services[action]
                if (!actionInst) {
                    event.sender.send(msgId, {
                        error: `No such action [${action}] in service [${service}]`
                    })
                    return
                }
                let result = actionInst(args)
                if (result) {
                    event.sender.send(msgId, {
                        result
                    })
                }
            }
        })
    }

    getPath(path) {
        if (typeof path === 'string') {
            return paths.join(this.rootPath, path)
        } else if (path instanceof Array) {
            console.log("paths " + path)
            return paths.join(this.rootPath, path.join(path))
        }
    }

    requireModule(module) {}
    requireService(service) {
        return this._services.proxy
    }
}
const launcher = new Launcher(paths.join(app.getPath('appData'), '.launcher'), app, modules, services)
export default launcher