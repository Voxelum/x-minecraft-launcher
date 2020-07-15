import { AZURE_CDN, AZURE_CDN_HOST, IS_DEV } from '@main/constant';
import { UpdateInfo as _UpdateInfo } from '@universal/store/modules/setting';
import { Task } from '@xmcl/task';
import { spawn } from 'child_process';
import { autoUpdater, Provider, UpdateInfo, UpdaterSignal } from 'electron-updater';
import { writeFile } from 'fs-extra';
import { closeSync, existsSync, open, rename, unlink } from 'original-fs';
import { basename, dirname, join } from 'path';
import { SemVer } from 'semver';
import { promisify } from 'util';
import ElectronLauncherApp from '../electron/ElectronLauncherApp';

/**
    * Only download asar file update.
    * 
    * If the this update is not a full update but an incremental update,
    * you can call this to download asar update
    */
export function downloadAsarUpdateTask(this: ElectronLauncherApp) {
    const downloadUpdate = Task.create('downloadUpdate', async (ctx: Task.Context) => {
        let updateInfo = this.storeManager.store.state.setting.updateInfo;

        const provider: Provider<UpdateInfo> = (await (autoUpdater as any).clientPromise);
        const files = provider.resolveFiles(updateInfo!);

        const uObject = files[0].url;
        uObject.pathname = `${uObject.pathname.substring(0, uObject.pathname.lastIndexOf('/'))}app.asar`;

        if (this.networkManager.isInGFW) {
            uObject.host = AZURE_CDN_HOST;
            uObject.hostname = AZURE_CDN_HOST;
            uObject.pathname = 'releases/app.asar';
        }

        let exePath = this.getPath('exe');
        let appPath = dirname(exePath);
        let updatePath = join(appPath, 'resources', 'update.asar.temp');
        await this.networkManager.downloadFileTask({ destination: updatePath, url: uObject.toString() })(ctx);
    });
    return downloadUpdate;
}
/**
 * Download the full update. This size can be larger as it carry the whole electron thing...
 */
export function downloadFullUpdateTask() {
    return Task.create('downloadUpdate', (ctx: Task.Context) => new Promise<void>((resolve, reject) => {
        autoUpdater.downloadUpdate().catch(reject);
        const signal = new UpdaterSignal(autoUpdater);
        signal.updateDownloaded(() => resolve());
        signal.progress((info) => { ctx.update(info.transferred, info.total); });
        signal.updateCancelled(reject);
        autoUpdater.on('error', reject);
    }));
}

export async function quitAndInstallAsar(this: ElectronLauncherApp) {
    if (IS_DEV) {
        return;
    }
    let exePath = process.argv[0];
    let appPath = dirname(exePath);

    let appAsarPath = join(appPath, 'resources', 'app.asar');
    let updateAsarPath = join(appPath, 'resources', 'update.asar.temp');

    if (this.platform.name === 'windows') {
        let elevatePath = join(appPath, 'resources', 'elevate.exe');

        if (!existsSync(updateAsarPath)) {
            throw new Error(`No update found: ${updateAsarPath}`);
        }
        if (!existsSync(elevatePath)) {
            throw new Error(`No elevate.exe found: ${elevatePath}`);
        }
        let psPath = join(this.root, 'temp', 'AutoUpdate.ps1');
        let hasWriteAccess = await new Promise((resolve) => {
            open(appAsarPath, 'a', (e, fd) => {
                if (e) {
                    resolve(false);
                } else {
                    closeSync(fd);
                    resolve(true);
                }
            });
        });

        // force elevation for now
        hasWriteAccess = false;

        this.log(hasWriteAccess ? `Process has write access to ${appAsarPath}` : `Process does not have write access to ${appAsarPath}`);
        let startProcessCmd = `Start-Process -FilePath "${process.argv[0]}"`;
        if (process.argv.slice(1).length > 0) {
            startProcessCmd += ` -ArgumentList ${process.argv.slice(1).map((s) => `"${s}"`).join(', ')}`;
        }
        startProcessCmd += ` -WorkingDirectory ${process.cwd()}`;
        await writeFile(psPath, [
            'Start-Sleep -s 3',
            `Copy-Item -Path "${updateAsarPath}" -Destination "${appAsarPath}"`,
            `Remove-Item -Path "${updateAsarPath}"`,
            startProcessCmd,
        ].join('\r\n'));

        let args = [
            'powershell.exe',
            '-ExecutionPolicy',
            'RemoteSigned',
            '-File',
            `"${psPath}"`,
        ];
        if (!hasWriteAccess) {
            args.unshift(elevatePath);
        }
        this.log(`Install from windows: ${args.join(' ')}`);
        this.log(`Relaunch the process by: ${startProcessCmd}`);

        spawn(args[0], args.slice(1), {
            detached: true,
        }).on('error', (e) => {
            this.error(e);
        }).on('exit', (code, s) => {
            this.log(`Update process exit ${code}`);
        }).unref();
    } else {
        await promisify(unlink)(appAsarPath);
        await promisify(rename)(updateAsarPath, appAsarPath);
    }
    this.quitApp();
}


export function quitAndInstallFullUpdate() {
    if (IS_DEV) {
        return;
    }
    autoUpdater.quitAndInstall();
}

let injectedUpdate = false;

export function checkUpdateTask(this: ElectronLauncherApp): Task<_UpdateInfo> {
    return Task.create('checkUpdate', async () => {
        autoUpdater.once('update-available', () => {
            this.log('Update available and set status to pending');
            this.storeManager.store.commit('updateStatus', 'pending');
        });
        const info = await autoUpdater.checkForUpdates();

        if (this.networkManager.isInGFW && !injectedUpdate) {
            injectedUpdate = true;
            const provider: Provider<UpdateInfo> = (await (autoUpdater as any).clientPromise);
            const originalResolve = provider.resolveFiles;
            provider.resolveFiles = (function (this: Provider<UpdateInfo>, inf: UpdateInfo) {
                let result = originalResolve.bind(provider)(inf);
                result.forEach((i) => {
                    let pathname = i.url.pathname;
                    (i as any).url = new URL(`${AZURE_CDN}/${basename(pathname)}`);
                });
                return result;
            });
        }

        let updateInfo: _UpdateInfo = info.updateInfo as _UpdateInfo;

        updateInfo.incremental = false;
        let currentVersion = autoUpdater.currentVersion;
        let newVersion = new SemVer(updateInfo.version);

        if (newVersion.major === currentVersion.major) {
            updateInfo.incremental = true;
        }

        return updateInfo;
    });
}
