const fs = require('fs')
const {
    AuthService
} = require('ts-minecraft')
const {
    v4
} = require('uuid')
export default {
    async login(account, password, mode, clientToken) {
        return new Promise((resolve, reject) => {
            if (mode == 'offline')
                resolve(AuthService.offlineAuth(account))
            else
                return AuthService.yggdrasilAuth(account, password, clientToken ? clientToken : v4())
        });
    },
}