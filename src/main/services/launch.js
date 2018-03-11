import paths from 'path'

import {
    Launcher,
    Version,
    AuthService,
    MinecraftFolder,
} from 'ts-minecraft'

function onerror(e) {
    if (e.message.startsWith('Cannot find version ') || e.message.startsWith('No version file for ') || e.message.startsWith('No version jar for ')) {
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
        launch(context, option) {
            console.log(option)
            return Launcher.launch(option).then((process) => {
                process.on('error', (err) => {
                    console.log(err)
                })
                process.on('exit', (code, signal) => {
                    console.log(`exit: ${code}, signal: ${signal}`)
                    ipcMain.emit('restart')
                })
                process.stdout.on('data', (s) => {
                    ipcMain.emit('minecraft-stdout', s.toString());
                })
                process.stderr.on('data', (s) => {
                    console.error(s)
                    ipcMain.emit('minecraft-stderr', s)
                })
            }).catch((e) => {
                throw onerror(e);
            })
        },
    },
}
