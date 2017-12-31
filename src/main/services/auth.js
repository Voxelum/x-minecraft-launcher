import { v4 } from 'uuid'

import { Auth } from 'ts-minecraft'

const registered = new Map()
export default {
    initialize() {
        registered.set('offline', ({
            account,
            clientToken,
        }) => Auth.offline(account));
        registered.set('mojang', ({ account, password, clientToken }) => Auth.yggdrasil({
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
        login(context, option) {
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
        /**
         * 
         * @param {{accessToken:string, clientToken:string}} payload 
         */
        validate(context, payload) {
            return Auth.Yggdrasil.create().validate(payload.accessToken, payload.clientToken);
        },
    },
}
