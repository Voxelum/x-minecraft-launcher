
import paths from 'path'
import { remote } from 'electron'
import fs from 'fs-extra'
import mcsettings from './mcsettings'

function findJavaFromHome(set) {
    const home = process.env.JAVA_HOME;
    if (!home) return set
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

(() => {
    const options = require('../../shared/options')
    for (const key in mcsettings) {
        if (mcsettings.hasOwnProperty(key)) {
            mcsettings[key] = Object.assign(mcsettings[key], options)
        }
    }
})()

export default {
    namespaced: true,
    state() {
        return {
            defaultResolution: { width: 400, height: 400, fullscreen: false },
            autoDownload: false,
            templates: {
                minecraft: mcsettings,
            },
            javas: [],
            default: 'semantic',
            theme: 'semantic',
            themes: [], // todo... I think we need a more generic way... 
        }
    },
    mutations: {
        javas(states, payload) {
            if (payload instanceof Array) states.javas = payload;
        },
        copyOptions(states, { from, to }) {
            const setting = states.templates.minecraft[from]
        },
    },
    getters: {
        errors(states) {
            const e = []
            if (states.javas.length === 0) e.push('setting.install.java')
            return e;
        },
        javas: states => states.javas,
        options: states => states.templates.minecraft,
        defaultJava: states => (states.javas.length !== 0 ? states.javas[0] : undefined),
        defaultOptions: states => states.templates.minecraft.midum,
    },
    actions: {
        load(context, payload) {
            context.dispatch('searchJava').then((javas) => {
                context.commit('javas', javas);
            })
            return context.dispatch('read', { path: 'setting.json' }, { root: true })
        },
        save() {
            return {}
        },
        searchJava() {
            return findJavaFromRegistry()
                .then(findJavaFromPath)
                .then(findJavaFromHome)
                .then(Array.from)
        },
    },
}
