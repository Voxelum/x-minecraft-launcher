
import {
    app,
    BrowserWindow,
    ipcMain,
} from 'electron'
import modules from './module-io'
import services from './services'

const paths = require('path')
const {
    EventEmitter,
} = require('events')

const rootPath = paths.join(app.getPath('appData'), '.launcher')
ipcMain.on('launcher', (event, payload) => {
    const msgId = payload.id
    if (payload.service) {
        const service = payload.service.id
        const action = payload.service.action
        const args = payload.service.args
        const serInst = this._services[service]
        if (!serInst) {
            event.sender.send(msgId, {
                error: `No such service [${service}]`,
            })
            return
        }
        const actionInst = serInst.services[action]
        if (!actionInst) {
            event.sender.send(msgId, {
                error: `No such action [${action}] in service [${service}]`,
            })
            return
        }
        const result = actionInst(args)
        if (result) {
            event.sender.send(msgId, {
                result,
            })
        }
    }
})
export default {
    rootPath,
    getPath(path) {
        if (typeof path === 'string') {
            return paths.join(rootPath, path)
        } else if (path instanceof Array) {
            return paths.join(rootPath, paths.join(path))
        }
        return rootPath
    },
    requireServiceProxy(service) {
        const queried = services[service]
        if (queried) {
            const proxy = Object.assign({}, queried.proxy)
            for (const key in queried.actions) {
                if (queried.actions.hasOwnProperty(key)) {
                    proxy[`$${key}`] = queried.actions[key];
                }
            }
            return proxy
        }
        return undefined
    },
}
