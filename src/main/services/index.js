import { ipcMain, Event } from 'electron'
import { EventEmitter } from 'events';
import { Task } from 'ts-minecraft'

import context from '../task.context'

const files = require.context('.', false, /\.js$/)
/**
 * @type {{[serviceId:string]: Service}}
 */
const modules = {}

files.keys().forEach((key) => {
    if (key === './index.js') return
    const id = key.replace(/(\.\/|\.js)/g, '')
    const instance = files(key).default
    if (!instance.id) instance.id = id
    modules[id] = instance
})

console.log('Start services initialize')
for (const key in modules) {
    if (modules.hasOwnProperty(key)) {
        const service = modules[key];
        if (service.initialize) {
            console.log(`Initializes service ${key}`)
            service.initialize();
        }
    }
}
console.log('End services initialize')

function execute() {

}

ipcMain.on('query',
    /**
     * @param {Event} event
     */
    (event, {
        id,
        service,
        action,
        payload,
    }) => {
        const serv = modules[service];
        const tempId = `${service}-${action}`
        if (!serv) {
            event.sender.send(id, 'error', [], `No such service [${service}]`)
            return;
        }
        if (!serv.actions) {
            event.sender.send(id, 'error', [], `Service [${service}] has no actions at all!`)
            return;
        }
        const act = serv.actions[action];
        if (!act) {
            event.sender.send(id, 'error', [], `No such action [${action}] in service [${service}]`)
            return;
        }
        console.log(`execute query ${service}/${action}`)
        const serviceContext = {
            uuid: id,
            source: event.sender,
            dispatch: ($service, $action, $payload) => {

            },
        }
        try {
            let result = act(serviceContext, payload);
            if (context.isTask(result)) {
                result = context.execute(id, tempId, event.sender, result)
            }
            if (result instanceof Promise) {
                result.then((resolved) => {
                    console.log(`resolve: ${service}/${action}`)
                    event.sender.send(id, 'finish', [], resolved)
                }, (rejected) => {
                    console.log(`reject: ${service}/${action}`)
                    console.log(rejected)
                    if (rejected instanceof Error) {
                        event.sender.send(id, 'error', [], { message: rejected.message, ...rejected })
                    } else {
                        event.sender.send(id, 'error', [], { ...rejected })
                    }
                })
            } else {
                console.log(`resolve: ${service}/${action}`)
                event.sender.send(id, 'finish', [], result)
            }
        } catch (e) {
            console.log(`reject: ${service}/${action}`)
            console.log(e)
            event.sender.send(id, 'error', [], { message: e.message, ...e })
        }
    })

export default modules
