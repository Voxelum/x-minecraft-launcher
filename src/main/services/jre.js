import { net, app } from 'electron'
import os from 'os'
import path from 'path'
import fs from 'fs-extra'
import download from 'ts-minecraft/dist/src/utils/download'
import Zip from 'jszip'


function findJavaFromHome(set) {
    const home = process.env.JAVA_HOME;
    if (!home) return set
    const javaPath = path.join(home, 'bin', 'javaw.exe')
    if (fs.existsSync(javaPath)) set.add(javaPath)
    return set
}

function findJavaFromPath(set) {
    const pathString = process.env.PATH
    const array = pathString.split(';')
    for (const p of array) {
        const javaPath = path.join(p, 'bin', 'javaw.exe')
        if (fs.existsSync(javaPath)) set.add(set)
    }
    return set
}
/**
* @author Indexyz 
*/
function findJavaFromRegistry(set) {
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
                .map(item => path.join(item, 'bin', 'javaw.exe'))
                .filter(item => fs.existsSync(item))))
        });
    });
}

// https://api.github.com/repos/Indexyz/ojrebuild/releases
async function installJre() {
    const info = await new Promise((resolve, reject) => {
        const req = net.request('https://api.github.com/repos/Indexyz/ojrebuild/releases')
        let infojson = ''
        req.on('response', (response) => {
            response.on('data', (data) => {
                infojson += data.toString();
            })
            response.on('end', () => {
                resolve(JSON.parse(infojson))
            })
            response.on('error', () => {
                console.error(`${response.headers}`);
            })
        })
        req.on('error', (err) => {
            reject(err)
        })
    });
    const latest = info[0];
    let buildSystemId;
    let arch;
    switch (os.arch()) {
        case 'x86':
        case 'x32':
            arch = 'x86'
        case 'x64':
            arch = 'x86_64'
    }
    switch (os.platform()) {
        case 'darwin': break;
        case 'win32':
            buildSystemId = 'windows'; break;
        case 'linux':
            buildSystemId = 'el6_9'
    }
    if (!buildSystemId) throw new Error(`Not supporting system ${os.platform()}`);
    if (!arch) throw new Error(`Not supporting arch ${os.arch()}`)
    const downURL = latest.assets.map(ass => ass['browser_download_url'])
        .filter(ass => {
            const arr = ass.split('.');
            return arr[arr.length - 2] === arch && sys === arr[arr.length - 3]
        })[0]
    const splt = downURL.split('/');
    const tempFileLoc = path.join(app.getPath('temp'), splt[splt.length - 1]);
    await fs.ensureFile(tempFileLoc)
    await download(downURL, tempFileLoc);
    const jreRoot = path.join(app.getPath('appData'), 'jre')
    const zip = await new Zip().loadAsync(await fs.readFile())
    const arr = []
    zip.forEach((name, entry) => {
        const target = path.resolve(jreRoot, name)
        arr.push(entry.async('nodebuffer')
            .then(buf => fs.ensureFile(target).then(() => buf))
            .then(buf => fs.writeFile(target, buf)))
    })
    await Promise.all(arr);
    await fs.unlink(tempFileLoc)
}

export default {
    initialize() {
    },
    actions: {
        async availbleJre() {
            const local = path.join(app.getPath('appData'), 'jre', 'bin', 'javaw.exe');
            if (fs.existsSync(local)) return [local]
            return await findJavaFromRegistry()
                .then(findJavaFromPath)
                .then(findJavaFromHome)
                .then(Array.from)
        },
        async ensureJre() {
            const local = path.join(app.getPath('appData'), 'jre', 'bin', 'javaw.exe');
            if (fs.existsSync(local)) return [local]
            const arr = await findJavaFromRegistry()
                .then(findJavaFromPath)
                .then(findJavaFromHome)
                .then(Array.from)
            if (arr.length === 0) {
                await installJre();
                return [local];
            } else return arr;
        },
    }
}