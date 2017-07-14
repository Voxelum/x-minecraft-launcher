const fs = require('fs')
const {
    AuthService
} = require('ts-minecraft')
const {
    v4
} = require('uuid')
export default {
    load(context) {
        return new Promise((resolve, reject) => {
            let json = context.getPath('auth.json')
            if (fs.existsSync(json)) {
                fs.readFile(json, (err, data) => {
                    if (err) reject(err)
                    else {
                        let inst = JSON.parse(data.toString())
                        //TODO validate inst
                        resolve(inst)
                    }
                })
            } else {
                resolve({
                    mode: 'mojang',
                    modes: ['mojang', 'offline'],
                    clientToken: "",
                    accessToken: '',
                    history: {}
                })
            }

        });
    },

    save(context, state) {
        return new Promise((resolve, reject) => {
            let json = context.getPath('auth.json')
            state.modes = undefined
            fs.writeFile(json, state, (err) => {
                if (err) reject(err)
                else resolve()
            })
        });
    }
}