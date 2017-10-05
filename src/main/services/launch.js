import paths from 'path'
import { ipcMain } from 'electron'

import {
    Launcher,
    Version,
    AuthService,
    MinecraftFolder,
} from 'ts-minecraft'

function onerror(e) {
    if (e.message.startsWith('Cannot find version ') || e.message.startsWith('No version file for ')) {
        e.type = 'missing.version'
    } else if (e.message === 'Missing library') {
        e.type = 'missing.libraries'
    } else if (e.message === 'Missing asset!') {
        e.type = 'missing.assets'
    } else if (e.message === 'Missing mainClass' || e.message === 'Missing minecraftArguments') {
        e.type = 'illegal.version.json'
    }
    return e
}

// import semver from 'semver'
export default {
    initialize() {
    },
    proxy: {
    },
    actions: {
        launch({ auth, option }) {
            console.log('launch:')
            console.log(option)
            return Launcher.launch(auth, option).then((process) => {
                process.on('error', (err) => {
                    console.error(err)
                })
                process.on('exit', (code, signal) => {
                    console.log('exit:')
                    console.log(code)
                    console.log(signal)
                    ipcMain.emit('restart')
                })
                process.stdout.on('data', (s) => {
                    ipcMain.emit('minecraft-stdout', s.toString());
                })
                process.stderr.on('data', (s) => {
                    ipcMain.emit('minecraft-stderr', s)
                })
            }).catch((e) => {
                throw onerror(e);
            })
        },
    },
}
