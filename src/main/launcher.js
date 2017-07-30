import {
    app,
    BrowserWindow,
    ipcMain,
} from 'electron'
import * as fs from 'fs'

import services from './services'

const paths = require('path')
const {
    EventEmitter,
} = require('events')

ipcMain.on('query', (event, payload) => {
    console.log(payload)
    const {
        id,
        service,
        action,
        args,
    } = payload
    const serInst = services[service];
    if (!serInst) {
        event.sender.send(id, {
            rejected: `No such service [${service}]`,
        })
        return;
    }
    if (!serInst.actions) {
        event.sender.send(id, {
            rejected: `Service [${service}] has no actions at all!`,
        })
        return;
    }
    const actionInst = serInst.actions[action];
    if (!actionInst) {
        event.sender.send(id, {
            rejected: `No such action [${action}] in service [${service}]`,
        });
        return;
    }
    console.log(`execute query ${service}/${action}`)
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
ipcMain.on('placeholder', (event, payload) => {
    const { tree } = payload;
    event.sender.send();
})
const rootPath = paths.join(app.getPath('appData'), '.launcher')
fs.mkdir(rootPath, (err) => { })
const pathArr = [rootPath]
export default {
    rootPath,
    getPath(...path) {
        return paths.join(rootPath, ...path)
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
