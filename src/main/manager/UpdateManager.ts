import { GFW_RELEASE_FEED_URL } from '@main/constant';
import BaseService from '@main/service/BaseService';
import { StaticStore } from '@main/util/staticStore';
import { Task } from '@xmcl/task';
import { autoUpdater, UpdaterSignal } from 'electron-updater';
import { Manager } from '.';

if (process.env.NODE_ENV === 'development') {
    autoUpdater.setFeedURL({
        provider: 'github',
        repo: 'VoxeLauncher',
        owner: 'voxelum',
    });
    autoUpdater.logger = null;
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

        this.managers.storeAndServiceManager.getService(BaseService)!.checkUpdate();
    }

    async downloadUpdate() {
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
            if (!this.store.state.setting.autoDownload) {
                this.store.commit('downloadingUpdate', true);
                // should swap download src to china mainland
                const swapDownloadSrc = this.managers.networkManager.isInGFW;
                let oldFeedUrl = '';
                if (swapDownloadSrc) {
                    oldFeedUrl = autoUpdater.getFeedURL() || '';
                    autoUpdater.setFeedURL(GFW_RELEASE_FEED_URL);
                    await autoUpdater.checkForUpdates();
                }
                try {
                    let promise = download(ctx);
                    if (swapDownloadSrc) {
                        promise = promise.catch(async (e) => {
                            this.warn('Cannot download update from azure source. Switch to github source!');
                            this.warn(e);
                            autoUpdater.setFeedURL(oldFeedUrl);
                            await autoUpdater.checkForUpdates();
                            return download(ctx);
                        });
                    }
                    await promise;
                    this.store.commit('readyToUpdate', true);
                } catch (e) {
                    this.store.commit('readyToUpdate', false);
                } finally {
                    this.store.commit('downloadingUpdate', false);
                }
            } else {
                throw 'cancelled';
            }
        });
        return this.managers.taskManager.submit(downloadUpdate);
    }

    quitAndInstall = autoUpdater.quitAndInstall;

    checkForUpdates = autoUpdater.checkForUpdates;
}
