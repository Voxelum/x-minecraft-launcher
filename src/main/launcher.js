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

ipcMain.on('query', (event, payload) => {
    const {
        id,
        service,
        action,
        args,
    } = payload
    const serInst = services[service];
    if (!serInst) {
        event.sender.send(id, {
            error: `No such service [${service}]`,
        })
        return;
    }
    const actionInst = serInst.actions[action];
    if (!actionInst) {
        event.sender.send(id, {
            error: `No such action [${action}] in service [${service}]`,
        });
        return;
    }
    const result = actionInst(args);
    if (result instanceof Promise) {
        result.then((resolved) => {
            event.sender.send(id, {
                resolved,
            })
        }, (rejected) => {
            event.sender.send(id, {
                rejected,
            })
        })
    } else if (result instanceof Error) {
        event.sender.send(id, {
            rejected: result,
        });
    } else {
        event.sender.send(id, {
            resolved: result,
        });
    }
})
const rootPath = paths.join(app.getPath('appData'), '.launcher')
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
