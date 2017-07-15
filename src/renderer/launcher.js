const {
    ipcRenderer,
} = require('electron')

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
            ipcRenderer.once(id, ({
                error,
                result,
            }) => {
                if (error) reject(error)
                else resolve(result)
            })
        });
    },
}
