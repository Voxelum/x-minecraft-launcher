import { autoUpdater } from 'electron-updater';
import { ipcMain } from 'electron';

if (process.env.NODE_ENV === 'development') {
    autoUpdater.setFeedURL({
        provider: 'github',
        repo: 'VoxeLauncher',
        owner: 'voxelum',
    });
    autoUpdater.logger = null;
}

ipcMain.on('store-ready', (store) => {
    store.watch(state => state.setting.autoInstallOnAppQuit, (autoInstallOnAppQuit) => {
        autoUpdater.autoInstallOnAppQuit = autoInstallOnAppQuit;
    });
    store.watch(state => state.setting.allowPrerelease, (allowPrerelease) => {
        autoUpdater.allowPrerelease = allowPrerelease;
    });
    store.watch(state => state.setting.autoDownload, (autoDownload) => {
        autoUpdater.autoDownload = autoDownload;
    });

    console.log(`Current version is ${autoUpdater.currentVersion.raw}`);

    autoUpdater.autoInstallOnAppQuit = store.state.setting.autoInstallOnAppQuit;
    autoUpdater.autoDownload = store.state.setting.autoDownload;
    autoUpdater.allowPrerelease = store.state.setting.allowPrerelease;

    store.dispatch('checkUpdate');
});
