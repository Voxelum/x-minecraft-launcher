import launcher from '../launcher'

const fs = require('fs')

export default {
    load(context) {
        const proxy = launcher.requireServiceProxy('auth')
        const modes = proxy.modes()
        return new Promise((resolve, reject) => {
            const json = context.getPath('auth.json')
            if (fs.existsSync(json)) {
                fs.readFile(json, (err, data) => {
                    if (err) reject(err)
                    else {
                        const inst = JSON.parse(data.toString())
                        // TODO validate inst
                        inst.mods = modes
                        resolve(inst)
                    }
                })
            } else {
                resolve({
                    mode: modes[0],
                    modes,
                    clientToken: '',
                    accessToken: '',
                    history: {},
                })
            }
        });
    },

    save(context, state) {
        return new Promise((resolve, reject) => {
            const json = context.getPath('auth.json')
            state.modes = undefined
            fs.writeFile(json, state, (err) => {
                if (err) reject(err)
                else resolve()
            })
        });
    },
}
