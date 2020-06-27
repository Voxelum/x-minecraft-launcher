import { IS_DEV } from '@main/constant';
import BaseService from '@main/service/BaseService';
import { StaticStore } from '@main/util/staticStore';
import { Task } from '@xmcl/task';
import { spawn } from 'child_process';
import { app } from 'electron';
import { autoUpdater, UpdateCheckResult, UpdaterSignal } from 'electron-updater';
import { existsSync } from 'fs';
import { rename, unlink, writeFile } from 'fs-extra';
import { dirname, join } from 'path';
import { Manager } from '.';

if (process.env.NODE_ENV === 'development') {
    autoUpdater.setFeedURL({
        provider: 'github',
        repo: 'VoxeLauncher',
        owner: 'voxelum',
    });
    autoUpdater.logger = null;
}

export interface UpdateInfo extends UpdateCheckResult {
    incremental: boolean;
}

export default class UpdateManager extends Manager {
    private store!: StaticStore<any>;

    storeReady(store: StaticStore<any>) {
        this.store = store;

        store.subscribe(({ type, payload }) => {
            if (type === 'autoInstallOnAppQuit') {
                autoUpdater.autoInstallOnAppQuit = payload;
            } else if (type === 'allowPrerelease') {
                autoUpdater.allowPrerelease = payload;
            } else if (type === 'autoDownload') {
                autoUpdater.autoDownload = payload;
            }
        });

        this.log(`Current core version is ${autoUpdater.currentVersion.raw}.`);

        autoUpdater.autoInstallOnAppQuit = store.state.setting.autoInstallOnAppQuit;
        autoUpdater.autoDownload = store.state.setting.autoDownload;
        autoUpdater.allowPrerelease = store.state.setting.allowPrerelease;

        this.store.commit('launcherVersion', autoUpdater.currentVersion.version);

        this.managers.serviceManager.getService(BaseService)!.checkUpdate();
    }

    /**
     * Only download asar file update.
     * 
     * If the this update is not a full update but an incremental update,
     * you can call this to download asar update
     */
    downloadAsarUpdateTask(url: string, sha512: string) {
        const downloadUpdate = Task.create('downloadUpdate', async (ctx: Task.Context) => {
            this.store.commit('downloadingUpdate', true);
            try {
                let exePath = this.managers.appManager.getPath('exe');
                let appPath = dirname(exePath);
                let updatePath = join(appPath, 'resources', 'update.asar');

                await this.managers.networkManager.downloadFileTask({ destination: updatePath, url, checksum: { algorithm: 'sha512', hash: sha512 } })(ctx);
                this.store.commit('readyToUpdate', 'asar');
            } catch (e) {
                this.store.commit('readyToUpdate', 'none');
            } finally {
                this.store.commit('downloadingUpdate', false);
            }
        });
        return downloadUpdate;
    }

    downloadFullUpdateTask() {
        function download(ctx: Task.Context) {
            return new Promise((resolve, reject) => {
                autoUpdater.downloadUpdate().catch(reject);
                const signal = new UpdaterSignal(autoUpdater);
                signal.updateDownloaded(resolve);
                signal.progress((info) => {
                    ctx.update(info.transferred, info.total);
                });
                signal.updateCancelled(reject);
                autoUpdater.on('error', reject);
            });
        }
        const downloadUpdate = Task.create('downloadUpdate', async (ctx: Task.Context) => {
            this.store.commit('downloadingUpdate', true);
            try {
                let promise = download(ctx);
                await promise;
                this.store.commit('readyToUpdate', 'full');
            } catch (e) {
                this.store.commit('readyToUpdate', 'none');
            } finally {
                this.store.commit('downloadingUpdate', false);
            }
        });
        return downloadUpdate;
    }

    async quitAndInstallAsar() {
        if (IS_DEV) {
            return;
        }
        let exePath = process.argv[0];
        let appPath = dirname(exePath);
        let appAsarPath = join(appPath, 'resources', 'app.asar');
        let updateAsarPath = join(appPath, 'resources', 'update.asar');

        if (this.managers.appManager.platform.name === 'windows') {
            let elevatePath = join(appPath, 'resources', 'elevate.exe');

            if (!existsSync(updateAsarPath)) {
                throw new Error(`No update found: ${updateAsarPath}`);
            }
            if (!existsSync(elevatePath)) {
                throw new Error(`No elevate.exe found: ${elevatePath}`);
            }
            let psPath = join(this.managers.appManager.root, 'temp', 'AutoUpdate.ps1');
            await writeFile(psPath, [
                'Start-Sleep -s 3',
                `Copy-Item -Path "${updateAsarPath}" -Destination "${appAsarPath}"`,
                `Remove-Item -Path "${updateAsarPath}"`,
                `Start-Process -FilePath ${process.argv[0]} -ArgumentList ${process.argv.slice(1).map((s) => `"${s}"`).join(', ')} -WorkingDirectory ${process.cwd()}`,
            ].join('\r\n'));

            let args = [
                'powershell.exe',
                '-ExecutionPolicy',
                'RemoteSigned',
                '-File',
                `"${psPath}"`,
            ];
            this.log(`Install from windows: ${elevatePath} ${args.join(' ')}`);

            spawn(elevatePath, args, {
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

    async checkForUpdates(): Promise<UpdateCheckResult> {
        let result = await autoUpdater.checkForUpdates();
        return result;
    }
}
