import { AZURE_CDN, AZURE_CDN_HOST, IS_DEV } from '@main/constant';
import BaseService from '@main/service/BaseService';
import { StaticStore } from '@main/util/staticStore';
import { UpdateInfo } from '@universal/store/modules/setting';
import { Task } from '@xmcl/task';
import { spawn } from 'child_process';
import { app } from 'electron';
import { autoUpdater, Provider, UpdateInfo as _UpdateInfo, UpdaterSignal } from 'electron-updater';
import { existsSync } from 'fs';
import { rename, unlink, writeFile } from 'fs-extra';
import { closeSync, open } from 'original-fs';
import { basename, dirname, join } from 'path';
import { SemVer } from 'semver';
import { Manager } from '.';

export default class UpdateManager extends Manager {
    private store!: StaticStore<any>;

    private injectedUpdate = false;

    storeReady(store: StaticStore<any>) {
        this.store = store;

        store.subscribe(({ type, payload }) => {
            if (type === 'autoInstallOnAppQuit') {
                autoUpdater.autoInstallOnAppQuit = payload;
            } else if (type === 'allowPrerelease') {
                // autoUpdater.allowPrerelease = payload;
            } else if (type === 'autoDownload') {
                autoUpdater.autoDownload = payload;
            }
        });

        this.log(`Current core version is ${autoUpdater.currentVersion.raw}.`);

        autoUpdater.autoInstallOnAppQuit = store.state.setting.autoInstallOnAppQuit;
        autoUpdater.autoDownload = store.state.setting.autoDownload;
        // autoUpdater.allowPrerelease = store.state.setting.allowPrerelease;

        autoUpdater.allowPrerelease = true;

        this.store.commit('version', [app.getVersion(), process.env.BUILD_NUMBER]);

        this.managers.serviceManager.getService(BaseService)!.checkUpdate();
    }

    /**
     * Only download asar file update.
     * 
     * If the this update is not a full update but an incremental update,
     * you can call this to download asar update
     */
    downloadAsarUpdateTask() {
        const downloadUpdate = Task.create('downloadUpdate', async (ctx: Task.Context) => {
            let updateInfo = this.store.state.setting.updateInfo;

            const provider: Provider<_UpdateInfo> = (await (autoUpdater as any).clientPromise);
            const files = provider.resolveFiles(updateInfo);

            const uObject = files[0].url;
            uObject.pathname = `${uObject.pathname.substring(0, uObject.pathname.lastIndexOf('/'))}app.asar`;

            if (this.managers.networkManager.isInGFW) {
                uObject.host = AZURE_CDN_HOST;
                uObject.hostname = AZURE_CDN_HOST;
                uObject.pathname = 'releases/app.asar';
            }

            let exePath = app.getPath('exe');
            let appPath = dirname(exePath);
            let updatePath = join(appPath, 'resources', 'update.asar.temp');
            await this.managers.networkManager.downloadFileTask({ destination: updatePath, url: uObject.toString() })(ctx);
        });
        return downloadUpdate;
    }

    /**
     * Download the full update. This size can be larger as it carry the whole electron thing...
     */
    downloadFullUpdateTask() {
        return Task.create('downloadUpdate', (ctx: Task.Context) => new Promise<void>((resolve, reject) => {
            autoUpdater.downloadUpdate().catch(reject);
            const signal = new UpdaterSignal(autoUpdater);
            signal.updateDownloaded(() => resolve());
            signal.progress((info) => { ctx.update(info.transferred, info.total); });
            signal.updateCancelled(reject);
            autoUpdater.on('error', reject);
        }));
    }

    /**
     * Check for x-launcher-minecraft-launcher platform has a version change
     */
    checkUpdateTask() {
        return Task.create('checkUpdate', async () => {
            autoUpdater.once('update-available', () => {
                this.log('Update available and set status to pending');
                this.store.commit('updateStatus', 'pending');
            });
            const info = await autoUpdater.checkForUpdates();

            if (this.managers.networkManager.isInGFW && !this.injectedUpdate) {
                this.injectedUpdate = true;
                const provider: Provider<_UpdateInfo> = (await (autoUpdater as any).clientPromise);
                const originalResolve = provider.resolveFiles;
                provider.resolveFiles = (function (this: Provider<_UpdateInfo>, inf: _UpdateInfo) {
                    let result = originalResolve.bind(provider)(inf);
                    result.forEach((i) => {
                        let pathname = i.url.pathname;
                        (i as any).url = new URL(`${AZURE_CDN}/${basename(pathname)}`);
                    });
                    return result;
                });
            }

            let updateInfo: UpdateInfo = info.updateInfo as UpdateInfo;

            updateInfo.incremental = false;
            let currentVersion = autoUpdater.currentVersion;
            let newVersion = new SemVer(updateInfo.version);

            if (newVersion.major === currentVersion.major) {
                updateInfo.incremental = true;
            }

            return updateInfo;
        });
    }

    async quitAndInstallAsar() {
        if (IS_DEV) {
            return;
        }
        let exePath = process.argv[0];
        let appPath = dirname(exePath);

        let appAsarPath = join(appPath, 'resources', 'app.asar');
        let updateAsarPath = join(appPath, 'resources', 'update.asar.temp');

        if (this.managers.appManager.platform.name === 'windows') {
            let elevatePath = join(appPath, 'resources', 'elevate.exe');

            if (!existsSync(updateAsarPath)) {
                throw new Error(`No update found: ${updateAsarPath}`);
            }
            if (!existsSync(elevatePath)) {
                throw new Error(`No elevate.exe found: ${elevatePath}`);
            }
            let psPath = join(this.managers.appManager.root, 'temp', 'AutoUpdate.ps1');
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
            await unlink(appAsarPath);
            await rename(updateAsarPath, appAsarPath);
        }
        app.quit();
    }

    quitAndInstallFullUpdate() {
        if (IS_DEV) {
            return;
        }
        autoUpdater.quitAndInstall();
    }
}
