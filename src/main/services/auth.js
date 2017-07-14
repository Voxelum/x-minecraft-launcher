const fs = require('fs')
const {
    AuthService
} = require('ts-minecraft')
import {
    v4
} from 'uuid'
import launcher from '../launcher'

const registered = new Map()
export default {
    initialize() {
        launcher.emit('init-auth', registry)
        registered.set('offline', ({
            account,
            clientToken
        }) => {
            return AuthService.offlineAuth(account)
        })
        registered.set('mojang', ({
            account,
            password,
            clientToken
        }) => {
            return AuthService.yggdrasilAuth(account, password, clientToken ? clientToken : v4())
        })
    },

    proxy: {
        register(id, func) {
            if (registered.has(id))
                throw 'duplicated id: ' + id
            registered.set(k, v)
        }
    },

    services: {
        login(optoin) {
            return new Promise((resolve, reject) => {
                if (registered.has(mode))
                    return registered.get(mode)(optoin)
                else reject('No such auth option!')
            });
        }
        //TODO implement other auth function
    }
}