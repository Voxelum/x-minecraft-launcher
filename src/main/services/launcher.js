import * as paths from 'path'
import { ipcMain } from 'electron'

const fs = require('fs');
const {
    Launcher,
    Version,
    AuthService,
    MinecraftFolder,
} = require('ts-minecraft')


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
                    console.log(s)
                })
                process.stderr.on('data', (s) => {
                    console.warn(s)
                })
            })
        },
    },
}
