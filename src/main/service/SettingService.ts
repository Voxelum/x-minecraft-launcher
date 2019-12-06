import { Task } from '@xmcl/minecraft-launcher-core';
import { autoUpdater, UpdaterSignal } from 'electron-updater';
import { gfw } from 'main/utils';
import locales from 'static/locales';
import { getPersistence, setPersistence } from 'main/utils/persistence';
import Service from './Service';

export default class SettingService extends Service {
    async load() {
        const data = await getPersistence({ path: this.getPath('setting.json'), schema: 'SettingConfig' }) || {};
        this.commit('config', {
            locale: data.locale,
            locales: Object.keys(locales),
            autoInstallOnAppQuit: data.autoInstallOnAppQuit,
            autoDownload: data.autoDownload,
            allowPrerelease: data.allowPrerelease,
            useBmclAPI: data.useBmclAPI,
            defaultBackgroundImage: data.defaultBackgroundImage,
            defaultBlur: data.defaultBlur,
            particleMode: data.particleMode,
            showParticle: data.showParticle,
            // settings: data.settings,
        });
    }

    async save({ mutation }: { mutation: string }) {
        switch (mutation) {
            case 'locale':
            case 'allowPrerelease':
            case 'autoInstallOnAppQuit':
            case 'autoDownload':
            case 'defaultBackgroundImage':
            case 'defaultBlur':
            case 'showParticle':
            case 'particleMode':
            case 'useBmclApi':
                await setPersistence({
                    path: this.getPath('setting.json'),
                    data: {
                        locale: this.state.setting.locale,
                        autoInstallOnAppQuit: this.state.setting.autoInstallOnAppQuit,
                        autoDownload: this.state.setting.autoDownload,
                        allowPrerelease: this.state.setting.allowPrerelease,
                        useBmclAPI: this.state.setting.useBmclAPI,
                        defaultBackgroundImage: this.state.setting.defaultBackgroundImage,
                        defaultBlur: this.state.setting.defaultBlur,
                        showParticle: this.state.setting.showParticle,
                        particleMode: this.state.setting.particleMode,
                    },
                });
                break;
            default:
        }
    }

    async quitAndInstall() {
        if (this.state.setting.readyToUpdate) {
            autoUpdater.quitAndInstall();
        }
    }

    async checkUpdate() {
        this.commit('checkingUpdate', true);
        const checkUpdate = async () => {
            try {
                const info = await autoUpdater.checkForUpdates();
                this.commit('updateInfo', info.updateInfo);
                return info;
            } catch {
                return undefined;
            } finally {
                this.commit('checkingUpdate', false);
            }
        };
        return this.submit(checkUpdate);
    }

    async downloadUpdate() {
        function download(ctx: Task.Context) {
            return new Promise((resolve, reject) => {
                autoUpdater.downloadUpdate().catch(reject);
                const signal = new UpdaterSignal(autoUpdater);
                signal.updateDownloaded((info) => {
                    resolve(info);
                });
                signal.progress((info) => {
                    ctx.update(info.transferred, info.total);
                });
                signal.updateCancelled((info) => {
                    reject(info);
                });
                autoUpdater.on('error', (err) => {
                    reject(err);
                });
            });
        }
        const downloadUpdate = async (ctx: Task.Context) => {
            if (!this.state.setting.autoDownload) {
                this.commit('downloadingUpdate', true);
                const swapDownloadSrc = await gfw();
                let oldFeedUrl = '';
                if (swapDownloadSrc) {
                    oldFeedUrl = autoUpdater.getFeedURL() || '';
                    autoUpdater.setFeedURL('https://voxelauncher.blob.core.windows.net/releases');
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
                    this.commit('readyToUpdate', true);
                } catch (e) {
                    this.commit('readyToUpdate', false);
                } finally {
                    this.commit('downloadingUpdate', false);
                }
            } else {
                throw 'cancelled';
            }
        };
        return this.submit(downloadUpdate);
    }
}
