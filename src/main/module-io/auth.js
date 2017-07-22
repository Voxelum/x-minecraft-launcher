import launcher from '../launcher'

const fs = require('fs')

export default {
    load() {
        const proxy = launcher.requireServiceProxy('auth')
        const modes = proxy.$modes()
        return new Promise((resolve, reject) => {
            const json = launcher.getPath('auth.json')
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

    save(mutation, state, payload) {
        return new Promise((resolve, reject) => {
            if (mutation.endsWith('/record')) {
                state.modes = undefined
                const json = launcher.getPath('auth.json')
                fs.writeFile(json, JSON.stringify(state), (err) => {
                    if (err) reject(err)
                    else resolve()
                })
            } else resolve()
        });
    },
}
