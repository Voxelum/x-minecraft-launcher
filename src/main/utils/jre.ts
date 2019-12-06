import { unpack } from '7zip-min';
import { Net, Task } from '@xmcl/minecraft-launcher-core';
import { vfs } from '@xmcl/util';
import { basename, resolve } from 'path';
import { platform } from './index';
import { fs } from './vfs';

function resolveArch() {
    switch (platform.arch) {
        case 'x86':
        case 'x32': return '32';
        case 'x64': return '64';
        default: return '32';
    }
}

export function installJreFromMojangTask(root: string) {
    async function installJreFromMojang(context: Task.Context) {
        const info: { [system: string]: { [arch: string]: { jre: { sha1: string; url: string; version: string } } } } = await context.execute({ name: 'fetchInfo', run: () => Net.fetchJson('https://launchermeta.mojang.com/mc/launcher.json').then(r => r.body) });
        const system = platform.name;
        const arch = resolveArch();

        if (system === 'unknown' || system === 'linux') {
            return;
        }
        const { sha1, url } = info[system][arch].jre;
        const filename = basename(url);
        const destination = resolve(root, 'temp', filename);

        if (!await vfs.validateSha1(destination, sha1)) {
            await fs.ensureFile(destination);
            await context.execute({
                name: 'download',
                run: Net.downloadFileIfAbsentWork({
                    url,
                    destination,
                    checksum: {
                        algorithm: 'sha1',
                        hash: sha1,
                    },
                }),
            });
        }

        const javaRoot = resolve(root, 'jre');
        await context.execute({
            name: 'decompress',
            run: async () => {
                await fs.ensureDir(javaRoot);
                await new Promise((resolve, reject) => {
                    unpack(destination, javaRoot, (e) => { if (e) reject(e); else resolve(); });
                });
            },
        });
        await context.execute({
            name: 'cleanup',
            run: async () => {
                await fs.unlink(destination);
            },
        });
    }

    return installJreFromMojang;
}

export function installJreFromSelfHostTask(root: string) {
    async function installJreFromSelfHost(context: Task.Context) {
        function resolveSystem() {
            switch (platform.name) {
                case 'windows': return 'win';
                default: return platform.name;
            }
        }
        const system = resolveSystem();
        const arch = resolveArch();
        if (system === 'unknown' || system === 'linux') {
            return;
        }
        const url = `https://voxelauncher.azurewebsites.net/api/v1/jre/${system}/${arch}`;
        const filename = 'jre.lzma';
        const dest = resolve(root, 'temp', filename);

        await fs.ensureFile(dest);
        await context.execute({
            name: 'download',
            run: () => Net.downloadFileWork({
                url,
                destination: dest,
            }),
        });

        const javaRoot = resolve(root, 'jre');
        await context.execute({
            name: 'decompress',
            run: async () => {
                await fs.ensureDir(javaRoot);
                await new Promise((resolve, reject) => {
                    unpack(dest, javaRoot, (e) => { if (e) reject(e); else resolve(); });
                });
            },
        });
        await context.execute({
            name: 'cleanup',
            run: async () => {
                await fs.unlink(dest);
            },
        });
    }
    return installJreFromSelfHost;
}

// export async function installJreFromBMCLAPI(context: Task.Context) {
//     console.log('Try auto Java from Bangbang source');
//     const x64 = platform.arch === 'x64';
//     function resolveJava() {
//         switch (platform.name) {
//             case 'osx': return 'jre_mac.dmg';
//             case 'windows': return x64 ? 'jre_x64.exe' : 'jre_x86.exe';
//             case 'linux': return x64 ? 'jre_x64.tar.gz' : 'jre_x86.tar.gz';
//             default: return '';
//         }
//     }
//     const filename = resolveJava();
//     const root = app.getPath('userData');
//     const javaRoot = resolve(root, 'jre');
//     const destination = resolve(root, 'temp', filename);
//     await context.execute('download', Net.downloadFileWork({
//         url: `http://bmclapi2.bangbang93.com/java/${filename}`,
//         destination,
//     }));

//     function exec_(cmd: string, option = {}) {
//         return new Promise((resolve, reject) => {
//             exec(cmd, option, (err, stdout, stderr) => {
//                 if (err) { reject(err); } else {
//                     resolve(stdout);
//                 }
//             });
//         });
//     }
//     switch (platform.name) {
//         case 'osx':
//             await fs.copyFile(join(__static, 'mac-jre-installer.sh'), join(root, 'temp', 'mac-jre-installer.sh'));
//             await fs.mkdir(join(root, 'jre'));
//             await exec_(join(root, 'temp', 'mac-jre-installer.sh'), { cwd: root });
//             break;
//         case 'windows':
//             await exec_([destination, `INSTALLDIR=${javaRoot}`, 'STATIC=1', 'INSTALL_SILENT=1', 'SPONSORS=0'].join(' '));
//             break;
//         case 'linux':
//             await exec_(`tar xvzf ${destination} -C ${join(root, 'jre')}`, { cwd: root });
//             break;
//         default:
//             break;
//     }
// }
