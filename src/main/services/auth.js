import { v4 } from 'uuid'

import { AuthService } from 'ts-minecraft'

const registered = new Map()
export default {
    initialize() {
        registered.set('offline', ({
            account,
            clientToken,
        }) => AuthService.offlineAuth(account));
        registered.set('mojang', ({ account, password, clientToken }) => AuthService.yggdrasilAuth({
            username: account,
            password,
            clientToken: clientToken || v4(),
        }));
    },

    proxy: {
        register(id, func) {
            if (registered.has(id)) throw new Error(`duplicated id: ${id}`)
            registered.set(id, func)
        },
    },

    actions: {
        /**
         * @param {{mode:string, account:string, password?:string, clientToken?:string}} option 
         */
        login(option) {
            return new Promise((resolve, reject) => {
                if (registered.has(option.mode)) {
                    resolve(registered.get(option.mode)(option))
                } else {
                    reject(`No such auth option ${option.mode}`)
                }
            });
        },

        modes() {
            return Array.from(registered.keys())
        },
        // TODO implement other auth function
    },
}
