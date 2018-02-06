import path from 'path'
import fs from 'fs-extra'
import os from 'os'

function findJavaFromHome(set) {
    const home = process.env.JAVA_HOME;
    if (!home) return set
    const javaPath = path.join(home, 'bin', 'javaw.exe')
    if (fs.existsSync(javaPath)) set[javaPath] = 0
    return set
}

function findJavaFromPath(set) {
    const pathString = process.env.PATH
    const array = pathString.split(';')
    for (const p of array) {
        const javaPath = path.join(p, 'bin', 'javaw.exe')
        if (fs.existsSync(javaPath)) set[javaPath] = 0
    }
    return set
}

/**
* @author Indexyz
*/
function findJavaFromRegistry() {
    let command;
    const childProcess = require('child_process');

    if (os.platform() === 'win32') command = 'REG QUERY HKEY_LOCAL_MACHINE\\Software\\JavaSoft\\ /s /v JavaHome'
    else command = 'find /usr/ -name java -type f'

    return new Promise((resolve, reject) => {
        childProcess.exec(command, (error, stdout, stderr) => {
            if (stdout) {
                const set = {}
                stdout.split(os.EOL).map(item => (os.platform() !== 'win32' ?
                    item.replace(/[\r\n]/g, '') :
                    item.replace(/[\r\n]/g, '').replace(/\\\\/g, '\\').match(/\w(:[\\a-zA-Z0-9 ._]*)/)))
                    .filter(item => item != null && item !== undefined)
                    .map(item => (item instanceof Array ? item[0] : item))
                    .map(item => (os.platform() === 'win32' ? path.join(item, 'bin', 'javaw.exe') : item))
                    .filter(item => fs.existsSync(item))
                    .forEach((item) => { set[item] = 0 })
                resolve(set);
            }
        });
    });
}

export default {
    namespaced: true,
    state: {
        javas: [],
        blacklist: [],
        default: '',
    },
    getters: {
        javas: state => state.javas.filter(loc => state.blacklist.indexOf(loc) === -1),
        defaultJava: state => state.default,
    },
    mutations: {
        javas(state, javas) {
            if (javas instanceof Array) state.javas = javas;
        },
        addJavaBlackList(state, java) { state.blacklist.push(java) },
    },
    actions: {
        addJavas(context, java) {
            context.commit('javas', context.getters.javas.concat(java))
        },
        addJava(context, java) {
            context.commit('addJava', context.getters.javas.concat(java))
        },
        removeJava(context, java) {
            const newarr = context.getters.javas.filter(j => j !== java);
            if (newarr.length !== context.getters.javas.length) {
                context.commit('javas', newarr)
            }
        },
        testJava(context, java) {

        },
        /**
         * scan local java locations and cache
         */
        updateJavas({ dispatch, commit }) {
            return dispatch('query', { service: 'jre', action: 'availbleJre' }, { root: true }).then((javas) => {
                commit('javas', javas);
                return javas;
            });
        },
        downloadJavas(context) {
            return context.dispatch('query', { service: 'jre', action: 'ensureJre' }, { root: true }).then((javas) => {
                context.commit('javas', javas);
                return javas;
            });
        },
    },
}
