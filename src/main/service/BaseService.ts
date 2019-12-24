import { copyPassively, exists } from '@xmcl/core/fs';
import { Task } from '@xmcl/task';
import { join } from 'path';
import Service from './Service';

export default class BaseService extends Service {
    async init() {
        this.scanLocalMinecraft();
    }

    async scanLocalMinecraft() {
        const mcPath = this.getMinecraftPath();
        if (await exists(mcPath)) {
            if (this.state.version.local.length === 0) {
                this.log('Try to migrate the version from .minecraft');
                await copyPassively(join(mcPath, 'libraries'), join(this.state.root, 'libraries'));
                await copyPassively(join(mcPath, 'assets'), join(this.state.root, 'assets'));
                await copyPassively(join(mcPath, 'versions'), join(this.state.root, 'versions'));
            }
        }
    }

    saveSites() {

    }

    getTrustedSites = this.managers.AppManager.getTrustedSites.bind(this.managers.AppManager);

    /**
     * Try to open a url in default browser. It will popup a message dialog to let user know.
     * If user does not trust the url, it won't open the site.
     * @param url The pending url
     */
    openInBrowser = this.managers.AppManager.openInBrowser.bind(this.managers.AppManager);

    /**
     * A electron provided function to show item in direcotry
     * @param path The path to the file item
     */
    showItemInDirectory = this.managers.AppManager.showItemInFolder;

    /**
     * A safe method that only open directory. If the `path` is a file, it won't execute it.
     * @param path The directory path.
     */
    openDirectory = this.managers.AppManager.openDirectory;

    async quitAndInstall() {
        if (this.state.setting.readyToUpdate) {
            this.managers.UpdateManager.quitAndInstall();
        }
    }

    async checkUpdate() {
        this.commit('checkingUpdate', true);
        const checkUpdate = Task.create('checkUpdate', async () => {
            try {
                const info = await this.managers.UpdateManager.checkForUpdates();
                this.commit('updateInfo', info.updateInfo);
                return info;
            } catch {
                return undefined;
            } finally {
                this.commit('checkingUpdate', false);
            }
        });
        return this.submit(checkUpdate);
    }

    /**
     * Download the update if there is avaiable update
     */
    downloadUpdate = this.managers.UpdateManager.downloadUpdate.bind(this.managers.AppManager);

    quit = this.managers.AppManager.quit;

    exit = this.managers.AppManager.exit;
}
