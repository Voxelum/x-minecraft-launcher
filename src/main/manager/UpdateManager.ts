import Task from '@xmcl/task';
import { autoUpdater, UpdaterSignal } from 'electron-updater';
import { GFW_RELEASE_FEED_URL } from 'main/constant';
import BaseService from 'main/service/BaseService';
import { Store } from 'vuex';
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
    private store!: Store<any>;

    storeReady(store: Store<any>) {
        this.store = store;

        store.watch(state => state.setting.autoInstallOnAppQuit, (autoInstallOnAppQuit) => {
            autoUpdater.autoInstallOnAppQuit = autoInstallOnAppQuit;
        });
        store.watch(state => state.setting.allowPrerelease, (allowPrerelease) => {
            autoUpdater.allowPrerelease = allowPrerelease;
        });
        store.watch(state => state.setting.autoDownload, (autoDownload) => {
            autoUpdater.autoDownload = autoDownload;
        });

        console.log(`Current core version is ${autoUpdater.currentVersion.raw}.`);

        autoUpdater.autoInstallOnAppQuit = store.state.setting.autoInstallOnAppQuit;
        autoUpdater.autoDownload = store.state.setting.autoDownload;
        autoUpdater.allowPrerelease = store.state.setting.allowPrerelease;

        this.managers.StoreAndServiceManager.getService(BaseService)!.checkUpdate();
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
                const swapDownloadSrc = this.managers.NetworkManager.isInGFW;
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
                            console.warn('Cannot download update from azure source. Switch to github source!');
                            console.warn(e);
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
        return this.managers.TaskManager.submit(downloadUpdate);
    }

    quitAndInstall = autoUpdater.quitAndInstall;

    checkForUpdates = autoUpdater.checkForUpdates;
}
