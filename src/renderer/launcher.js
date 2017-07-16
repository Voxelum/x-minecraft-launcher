import {
    ipcRenderer,
} from 'electron'

import {
    v4,
} from 'uuid'

export default {
    query(service, action, ...args) {
        return new Promise((resolve, reject) => {
            const id = v4()
            ipcRenderer.send('launcher', {
                id,
                service: {
                    id: service,
                    action,
                    args,
                },
            })
            ipcRenderer.once(id, (event, {
                error,
                result,
            }) => {
                if (error) reject(error)
                else resolve(result)
            })
        });
    },
    fetchAll() {
        return new Promise((resolve, reject) => {
            ipcRenderer.send('fetchAll');
            ipcRenderer.once('fetchAll', (event, err, states) => {
                if (err) reject(err)
                else resolve(states)
            })
        });
    },
    fetch(moduleId) {
        return new Promise((resolve, reject) => {
            ipcRenderer.send('fetch', moduleId)
            ipcRenderer.once('fetch', (event, err, state) => {
                if (err) reject(err)
                else resolve(state)
            })
        });
    },
    update(moduleId, state) {
        return new Promise((resolve, reject) => {
            ipcRenderer.send('update', {
                id: moduleId,
                state
            })
            ipcRenderer.once('update', (event, err) => {
                if (err) reject(err)
                else resolve()
            })
        });
    }
}
