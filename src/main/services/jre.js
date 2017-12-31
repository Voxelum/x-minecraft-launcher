import { net, app } from 'electron'
import os from 'os'
import path from 'path'
import fs from 'fs-extra'
import download from 'ts-minecraft/dist/src/utils/download'
import Zip from 'jszip'
import childProcess from 'child_process';


/**
* @author Indexyz
*/
async function findWinJava() {
    const command = 'REG QUERY HKEY_LOCAL_MACHINE\\Software\\JavaSoft\\ /s /v JavaHome'
    const set = await new Promise((resolve, reject) => {
        childProcess.exec(command, (error, stdout, stderr) => {
            if (stdout) {
                const $set = {}
                stdout.split(os.EOL).map(item => (os.platform() !== 'win32' ?
                    item.replace(/[\r\n]/g, '') :
                    item.replace(/[\r\n]/g, '').replace(/\\\\/g, '\\').match(/\w(:[\\a-zA-Z0-9 ._]*)/)))
                    .filter(item => item != null && item !== undefined)
                    .map(item => (item instanceof Array ? item[0] : item))
                    .map(item => path.join(item, 'bin', 'javaw.exe'))
                    .filter(item => fs.existsSync(item))
                    .forEach((item) => { $set[item] = 0 })
                resolve($set);
            }
        });
    });

    const home = process.env.JAVA_HOME;
    if (!home) return set
    const javaPath = path.join(home, 'bin', 'javaw.exe')
    if (fs.existsSync(javaPath)) set[javaPath] = 0

    const pathString = process.env.PATH
    const array = pathString.split(';')
    for (const p of array) {
        const jp = path.join(p, 'bin', 'javaw.exe')
        if (fs.existsSync(jp)) set[jp] = 0
    }

    return set;
}

function findMacJava(set) {
    set['/Library/Internet Plug-Ins/JavaAppletPlugin.plugin/Contents/Home/bin/java'] = 0
    return new Promise((resolve, reject) => {
        childProcess.exec('which java', (error, stdout, stderr) => {
            if (error) reject(error)
            else if (stdout) {
                set[stdout.trim()] = 0;
                resolve(set);
            }
        });
    });
}

// https://api.github.com/repos/Indexyz/ojrebuild/releases
async function installJre() {
    const info = await new Promise((resolve, reject) => {
        const req = net.request({
            method: 'GET',
            protocol: 'https:',
            hostname: 'api.github.com',
            path: '/repos/Indexyz/ojrebuild/releases',
        })
        req.setHeader('User-Agent', 'ILauncher')
        req.end();
        let infojson = ''
        req.on('response', (response) => {
            response.on('data', (data) => {
                infojson += data.toString();
            })
            response.on('end', () => {
                resolve(JSON.parse(infojson))
            })
            response.on('error', (e) => {
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
            break;
        case 'x64':
            arch = 'x86_64'
            break;
        default:
            arch = 'x86';
    }
    switch (os.platform()) {
        case 'darwin': break;
        case 'win32':
            buildSystemId = 'windows';
            break;
        case 'linux':
            buildSystemId = 'el6_9';
            break;
        default:
            buildSystemId = ''
    }
    if (!buildSystemId) throw new Error(`Not supporting system ${os.platform()}`);
    if (!arch) throw new Error(`Not supporting arch ${os.arch()}`)
    const downURL = latest.assets.map(ass => ass.browser_download_url)
        .filter((ass) => {
            const arr = ass.split('.');
            return arr[arr.length - 2] === arch // && sys === arr[arr.length - 3]
        })[0]
    const splt = downURL.split('/');
    const tempFileLoc = path.join(app.getPath('temp'), splt[splt.length - 1]);
    console.log('start download')
    console.log(tempFileLoc);
    await fs.ensureFile(tempFileLoc)
    console.log(`download url ${downURL}`)
    await download(downURL, tempFileLoc);
    const jreRoot = path.join(app.getPath('userData'), 'jre')
    console.log(`jreRoot ${jreRoot}`)
    const zip = await new Zip().loadAsync(await fs.readFile())
    const arr = []
    zip.forEach((name, entry) => {
        console.log(`unzip ${name}`)
        const target = path.resolve(jreRoot, name)
        arr.push(entry.async('nodebuffer')
            .then(buf => fs.ensureFile(target).then(() => buf))
            .then(buf => fs.writeFile(target, buf)))
    })
    await Promise.all(arr);
    console.log('deleting temp')
    await fs.unlink(tempFileLoc)
}

export default {
    initialize() {
    },
    actions: {
        async validate(context, jrePath) {
            if (typeof jrePath !== 'string') throw new Error('Jre path has to be a string!')
            jrePath = `"${jrePath.trim()}"`;
            const valid = await new Promise((resolve, reject) => {
                childProcess.exec(jrePath, (err, stdo, stde) => {
                    resolve(err.code === 1);
                })
            })
            if (!valid) return { valid: false, path: jrePath };
            return new Promise((resolve, reject) => {
                childProcess.exec(`${jrePath} --version`, (err, stdo, stde) => {
                    if (err) reject({ valid: false, path: jrePath })
                    resolve({ valid: true, path: jrePath, description: stdo.trim() })
                })
            })
        },
        async availableJre() {
            const set = {}
            let local;
            switch (os.platform()) {
                case 'darwin':
                    await findMacJava(set);
                    local = path.join(app.getPath('userData'), 'jre', 'bin', 'javaw');
                    if (fs.existsSync(local)) set[local] = 0;
                    break;
                case 'win32':
                    local = path.join(app.getPath('userData'), 'jre', 'bin', 'javaw.exe');
                    await findWinJava(set);
                    if (fs.existsSync(local)) set[local] = 0;
                    break;
                default:
            }
            return set;
        },
        async ensureJre() {
            // const local = path.join(app.getPath('userData'), 'jre', 'bin', 'javaw.exe');
            // if (fs.existsSync(local)) return [local]
            // const arr = await findJavaFromRegistry()
            //     .then(findJavaFromPath)
            //     .then(findJavaFromHome)
            //     .then(Object.keys)
            // if (arr.length === 0) {
            //     await installJre();
            //     return [local];
            // }
            // return arr;
        },
    },
}
