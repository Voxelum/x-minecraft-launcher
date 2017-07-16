
import {
    v4,
} from 'uuid'
import launcher from '../launcher'

const fs = require('fs')
const {
    AuthService,
} = require('ts-minecraft')

const registered = new Map()
export default {
    initialize() {
        registered.set('offline', ({
            account,
            clientToken,
        }) => AuthService.offlineAuth(account));
        registered.set('mojang', ({
            account,
            password,
            clientToken,
        }) => AuthService.yggdrasilAuth(account, password, clientToken || v4()));
    },

    proxy: {
        register(id, func) {
            if (registered.has(id)) {
                throw new Error(`duplicated id: ${id}`)
            }
            registered.set(id, func)
        },
        modes() {
            return Array.from(registered.keys())
        },
    },

    actions: {
        login(optoin) {
            return new Promise((resolve, reject) => {
                if (registered.has(optoin.mode)) {
                    resolve(registered.get(optoin.mode)(optoin))
                } else {
                    reject('No such auth option!')
                }
            });
        },
        // TODO implement other auth function
    },
}
