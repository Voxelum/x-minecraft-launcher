import { copyPassively, exists } from '@main/util/fs';
import { Task } from '@xmcl/task';
import { join } from 'path';
import Service, { Singleton } from './Service';

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

    /**
     * Try to open a url in default browser. It will popup a message dialog to let user know.
     * If user does not trust the url, it won't open the site.
     * @param url The pending url
     */
    openInBrowser = this.app.openInBrowser.bind(this.app);

    /**
     * A electron provided function to show item in direcotry
     * @param path The path to the file item
     */
    showItemInDirectory = this.app.showItemInFolder;

    /**
     * A safe method that only open directory. If the `path` is a file, it won't execute it.
     * @param path The directory path.
     */
    openDirectory = this.app.openDirectory;

    async quitAndInstall() {
        if (this.state.setting.updateStatus === 'ready') {
            if (this.state.setting.updateInfo?.incremental) {
                this.warn('Restart to install a asar update!');
                await this.updateManager.quitAndInstallAsar();
            } else {
                this.warn('Restart to install a full update!');
                this.updateManager.quitAndInstallFullUpdate();
            }
        } else {
            this.warn('There is no update avaiable!');
        }
    }

    @Singleton()
    async checkUpdate() {
        let handle = this.submit(this.app.checkUpdateTask());
        try {
            this.log('Check update');
            let info = await handle.wait();
            this.commit('updateInfo', info);
        } catch (e) {
            this.error('Check update failed');
            this.error(e);
            throw e;
        }
    }

    /**
     * Download the update if there is avaiable update
     */
    @Singleton()
    async downloadUpdate() {
        if (!this.state.setting.updateInfo) {
            throw new Error('Cannot download update if we don\'t check the version update!');
        }
        let task: Task<void> = this.app.downloadUpdateTask();
        let handle = this.submit(task);
        await handle.wait();
        this.commit('updateStatus', 'ready');
    }

    quit = this.app.quit.bind(this.app);

    exit = this.app.exit;
}
