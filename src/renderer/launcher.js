import {
    ipcRenderer,
} from 'electron'

import {
    v4,
} from 'uuid'

function privateLine(channel, payload, decode) {
    return new Promise((resolve, reject) => {
        ipcRenderer.send(channel, payload);
        ipcRenderer.once(channel, (event, reply) => {
            if (!reply) resolve()
            else {
                const rejected = reply.rejected;
                let resolved = reply.resolved;
                if (rejected) reject(rejected)
                else {
                    if (decode) resolved = decode(resolved)
                    resolve(resolved)
                }
            }
        })
    });
}
export default {
    query(service, action, args) {
        return new Promise((resolve, reject) => {
            const id = v4()
            ipcRenderer.send('query', {
                id,
                service,
                action,
                args,
            })
            ipcRenderer.once(id, (event, {
                rejected,
                resolved,
            }) => {
                if (rejected) reject(rejected)
                else resolve(resolved)
            })
        });
    },
    fetchAll() {
        return privateLine('fetchAll');
    },
    fetch(moduleId) {
        return privateLine('fetch', {
            moduleId,
        });
    },
    update(moduleId, mutation, state) {
        return privateLine('update', {
            id: moduleId,
            mutation,
            state,
        });
    },
    reloadModule(moduleId, state) {
        
    },
}
