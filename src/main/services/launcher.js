import * as paths from 'path'
import { ipcMain } from 'electron'
import launcher from '../launcher'

const fs = require('fs');
const {
    Launcher,
    Version,
    AuthService,
    MinecraftFolder,
} = require('ts-minecraft')

// import semver from 'semver'

function findJavaFromHome(set) {
    const home = process.env.JAVA_HOME;
    const javaPath = paths.join(home, 'bin', 'javaw.exe')
    if (fs.existsSync(javaPath)) set.add(javaPath)
    return set
}

function findJavaFromPath(set) {
    const pathString = process.env.PATH
    const array = pathString.split(';')
    for (const p of array) {
        const javaPath = paths.join(p, 'bin', 'javaw.exe')
        if (fs.existsSync(javaPath)) set.add(set)
    }
    return set
}
/**
* @author Indexyz 
*/
function findJavaFromRegistry() {
    let command;
    const childProcess = require('child_process');
    const os = require('os');

    if (os.platform() === 'win32') command = 'REG QUERY HKEY_LOCAL_MACHINE\\Software\\JavaSoft\\ /s /v JavaHome'
    else command = 'find /usr/ -name java -type f'

    return new Promise((resolve, reject) => {
        childProcess.exec(command, (error, stdout, stderr) => {
            if (error) reject(error)
            resolve(new Set(stdout.split(os.EOL).map(item => (os.platform() !== 'win32' ?
                item.replace(/[\r\n]/g, '') :
                item.replace(/[\r\n]/g, '').replace(/\\\\/g, '\\').match(/\w(:[\\a-zA-Z0-9 ._]*)/)))
                .filter(item => item != null && item !== undefined)
                .map(item => item[0])
                .map(item => paths.join(item, 'bin', 'javaw.exe'))
                .filter(item => fs.existsSync(item))))
        });
    });
}
export default {
    initialize() {
    },
    proxy: {
    },
    actions: {
        searchJava() {
            return findJavaFromRegistry()
                .then(findJavaFromPath)
                .then(findJavaFromHome)
                .then(Array.from)
        },
        launch({ auth, option }) {
            console.log(auth)
            console.log(option)
            ipcMain.emit('park')
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
