import { Store } from 'vuex';
import { autoUpdater } from 'electron-updater';
import SettingService from 'main/service/SettingService';
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
    storeReady(store: Store<any>) {
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

        this.managers.StoreAndServiceManager.getService(SettingService)!.checkUpdate();
    }
}
